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

/**
 * `match_text` holds a comma-separated list of terms; a rule matches when ANY
 * of them matches. Newlines work as separators too, so a pasted list is fine.
 */
export function splitTerms(matchText: string | null | undefined): string[] {
  return (matchText ?? "")
    .split(/[,\n;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/** Split free text into words, treating any non letter/digit as a separator. */
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

const HEBREW = /[\u0590-\u05FF]/;
// Single-letter prefixes (ה"ב כל"ם ו ש) and the common two-letter combinations.
const HE_PREFIXES = ["כשה", "ולה", "מה", "שה", "וה", "בה", "לה", "כה", "כש", "ול", "וב", "ומ", "ה", "ו", "ב", "ל", "מ", "כ", "ש"];
// Feminine/plural endings, longest first.
const HE_SUFFIXES = ["ותיהם", "ותיו", "ויות", "ניות", "יות", "ות", "ים", "יה", "ה", "ת", "י", "ן"];

/**
 * Reduce a Hebrew word to a rough stem so inflections of the same word collapse
 * together: עמלה / עמלת / עמלות / העמלה / ועמלות all reduce to "עמל".
 * Deliberately shallow — this is a matching aid, not a morphological analyser.
 */
function stem(word: string): string {
  let w = word;
  if (!HEBREW.test(w)) {
    // Latin: just drop a trailing plural "s".
    return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
  }
  for (const p of HE_PREFIXES) {
    if (w.length - p.length >= 3 && w.startsWith(p)) {
      w = w.slice(p.length);
      break;
    }
  }
  for (const s of HE_SUFFIXES) {
    if (w.length - s.length >= 2 && w.endsWith(s)) {
      w = w.slice(0, -s.length);
      break;
    }
  }
  return w;
}

/** Does a single term match this field value, under the rule's options? */
function termMatchesField(term: string, value: string, wholeWord: boolean, smart: boolean): boolean {
  if (!value) return false;
  const haystack = value.toLowerCase();

  if (!wholeWord && haystack.includes(term)) return true;

  const tokens = tokenize(haystack);
  const termTokens = tokenize(term);
  if (termTokens.length === 0) return false;

  // A multi-word term ("עמלת ניהול") has to appear as a consecutive run of words.
  const runMatches = (compare: (a: string, b: string) => boolean) => {
    for (let i = 0; i + termTokens.length <= tokens.length; i++) {
      if (termTokens.every((tt, j) => compare(tokens[i + j]!, tt))) return true;
    }
    return false;
  };

  if (runMatches((a, b) => a === b)) return true;
  if (!smart) return false;

  return runMatches((a, b) => {
    const sa = stem(a);
    const sb = stem(b);
    if (sa === sb) return true;
    // Allow one to be a longer form of the other, e.g. "עמל" vs "עמלת".
    return sb.length >= 3 && (sa.startsWith(sb) || sb.startsWith(sa));
  });
}

export function ruleMatches(rule: Rule, tx: CandidateTx): boolean {
  if (rule.account_id && rule.account_id !== tx.account_id) return false;

  const amount = tx.amount == null ? null : Math.abs(Number(tx.amount));
  if (rule.amount_min != null && (amount == null || amount < Number(rule.amount_min))) return false;
  if (rule.amount_max != null && (amount == null || amount > Number(rule.amount_max))) return false;

  const terms = splitTerms(rule.match_text);
  if (terms.length > 0) {
    const fields =
      rule.match_field === "any"
        ? [tx.payee, tx.description, tx.reference]
        : [tx[rule.match_field]];
    const wholeWord = rule.match_whole_word ?? true;
    const smart = rule.match_smart ?? false;
    const hit = terms.some((term) => fields.some((f) => termMatchesField(term, f ?? "", wholeWord, smart)));
    if (!hit) return false;
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
