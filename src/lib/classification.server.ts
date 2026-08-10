import type { SupabaseClient } from "@supabase/supabase-js";

export type Rule = {
  id: string;
  name: string;
  is_active: boolean;
  mode: "auto" | "suggest";
  priority: number;
  match_field: "payee" | "description" | "reference" | "any";
  match_text: string | null;
  match_whole_word: boolean | null;
  match_smart: boolean | null;
  account_id: string | null;
  amount_min: number | null;
  amount_max: number | null;
  set_fund_id: string | null;
  set_expense_type_id: string | null;
  set_category_id: string | null;
  set_subcategory_id: string | null;
  applied_count: number;
};


export type CandidateTx = {
  id: string;
  account_id: string;
  amount: number | null;
  payee: string | null;
  description: string | null;
  reference: string | null;
  fund_id: string | null;
  expense_type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
};

const TARGETS = [
  ["set_fund_id", "fund_id"],
  ["set_expense_type_id", "expense_type_id"],
  ["set_category_id", "category_id"],
  ["set_subcategory_id", "subcategory_id"],
] as const;

export function ruleMatches(rule: Rule, tx: CandidateTx): boolean {
  if (rule.account_id && rule.account_id !== tx.account_id) return false;

  const amount = tx.amount == null ? null : Math.abs(Number(tx.amount));
  if (rule.amount_min != null && (amount == null || amount < Number(rule.amount_min))) return false;
  if (rule.amount_max != null && (amount == null || amount > Number(rule.amount_max))) return false;

  const needle = (rule.match_text ?? "").trim().toLowerCase();
  if (needle) {
    const fields =
      rule.match_field === "any"
        ? [tx.payee, tx.description, tx.reference]
        : [tx[rule.match_field]];
    if (!fields.some((f) => (f ?? "").toLowerCase().includes(needle))) return false;
  }
  return true;
}

/** Fields the rule would fill in that are still empty on the transaction. */
export function pendingChanges(rule: Rule, tx: CandidateTx): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const [ruleField, txField] of TARGETS) {
    const value = rule[ruleField];
    if (value && !tx[txField]) patch[txField] = value;
  }
  return patch;
}

export function isUnclassified(tx: CandidateTx): boolean {
  return !tx.fund_id || !tx.expense_type_id;
}

/** Fetch every transaction that any rule could still act on. */
export async function fetchCandidates(
  supabase: SupabaseClient<any>,
  onlyUnclassified: boolean,
): Promise<CandidateTx[]> {
  const columns =
    "id, account_id, amount, payee, description, reference, fund_id, expense_type_id, category_id, subcategory_id";
  const out: CandidateTx[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from("transactions").select(columns).order("id").range(from, from + pageSize - 1);
    if (onlyUnclassified) query = query.or("fund_id.is.null,expense_type_id.is.null");
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as CandidateTx[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

export type RunResult = {
  matched: number;
  applied: number;
  suggested: number;
  perRule: { ruleId: string; name: string; mode: string; matched: number }[];
  sample: { id: string; payee: string | null; description: string | null; rule: string; patch: Record<string, string> }[];
};

/**
 * Run the active rules over the candidate set.
 * `dryRun` computes the outcome without writing anything.
 */
export async function runRules(
  supabase: SupabaseClient<any>,
  opts: { ruleId?: string; onlyUnclassified?: boolean; dryRun?: boolean },
): Promise<RunResult> {
  const { ruleId, onlyUnclassified = true, dryRun = false } = opts;

  let rq = supabase.from("classification_rules").select("*").eq("is_active", true).order("priority");
  if (ruleId) rq = rq.eq("id", ruleId);
  const { data: ruleRows, error: ruleErr } = await rq;
  if (ruleErr) throw new Error(ruleErr.message);
  const rules = (ruleRows ?? []) as unknown as Rule[];
  if (rules.length === 0) {
    return { matched: 0, applied: 0, suggested: 0, perRule: [], sample: [] };
  }

  const candidates = await fetchCandidates(supabase, onlyUnclassified);

  const perRule = new Map<string, number>();
  const sample: RunResult["sample"] = [];
  const updates: { id: string; patch: Record<string, string>; ruleId: string }[] = [];
  const suggestions: { transaction_id: string; rule_id: string }[] = [];

  for (const tx of candidates) {
    // Highest priority (lowest number) rule wins per field; a later rule may
    // still fill a field an earlier one left empty.
    const working: CandidateTx = { ...tx };
    const patch: Record<string, string> = {};
    let firstRule: Rule | null = null;

    for (const rule of rules) {
      if (!ruleMatches(rule, working)) continue;
      const changes = pendingChanges(rule, working);
      if (Object.keys(changes).length === 0) continue;
      perRule.set(rule.id, (perRule.get(rule.id) ?? 0) + 1);

      if (rule.mode === "suggest") {
        suggestions.push({ transaction_id: tx.id, rule_id: rule.id });
        continue;
      }
      Object.assign(patch, changes);
      Object.assign(working, changes);
      if (!firstRule) firstRule = rule;
    }

    if (Object.keys(patch).length > 0 && firstRule) {
      updates.push({ id: tx.id, patch, ruleId: firstRule.id });
      if (sample.length < 25) {
        sample.push({ id: tx.id, payee: tx.payee, description: tx.description, rule: firstRule.name, patch });
      }
    }
  }

  if (!dryRun) {
    for (const u of updates) {
      const { error } = await supabase.from("transactions").update(u.patch).eq("id", u.id);
      if (error) throw new Error(error.message);
    }
    if (suggestions.length > 0) {
      const { error } = await supabase
        .from("classification_suggestions")
        .upsert(suggestions, { onConflict: "transaction_id,rule_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    for (const [id, count] of perRule) {
      const rule = rules.find((r) => r.id === id);
      if (!rule) continue;
      await supabase
        .from("classification_rules")
        .update({ applied_count: (rule.applied_count ?? 0) + count })
        .eq("id", id);
    }
  }

  return {
    matched: updates.length + suggestions.length,
    applied: updates.length,
    suggested: suggestions.length,
    perRule: rules.map((r) => ({ ruleId: r.id, name: r.name, mode: r.mode, matched: perRule.get(r.id) ?? 0 })),
    sample,
  };
}
