import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertEditor(ctx: any) {
  const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "editor" }),
  ]);
  if (!isAdmin && !isEditor) throw new Error("Forbidden");
}

export const previewClassificationRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ruleId?: string; onlyUnclassified?: boolean; overwrite?: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertEditor(context);
    const { runRules } = await import("@/lib/classification.server");
    return runRules(context.supabase, { ...data, dryRun: true });
  });

export const applyClassificationRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ruleId?: string; onlyUnclassified?: boolean; overwrite?: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertEditor(context);
    const { runRules } = await import("@/lib/classification.server");
    return runRules(context.supabase, { ...data, dryRun: false });
  });

export const listPendingSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("classification_suggestions")
      .select(
        "id, status, created_at, rule:classification_rules(id, name, set_fund_id, set_expense_type_id, set_category_id, set_subcategory_id), transaction:transactions(id, transaction_date, value_date, amount, payee, description, reference, account_id, fund_id, expense_type_id, category_id, subcategory_id)",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const resolveSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; accept: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertEditor(context);
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("classification_suggestions")
      .select(
        "id, transaction_id, rule:classification_rules(set_fund_id, set_expense_type_id, set_category_id, set_subcategory_id), transaction:transactions(fund_id, expense_type_id, category_id, subcategory_id)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("ההצעה לא נמצאה");

    if (data.accept) {
      const rule = (row as any).rule ?? {};
      const tx = (row as any).transaction ?? {};
      const patch: Record<string, string> = {};
      for (const [from, to] of [
        ["set_fund_id", "fund_id"],
        ["set_expense_type_id", "expense_type_id"],
        ["set_category_id", "category_id"],
        ["set_subcategory_id", "subcategory_id"],
      ] as const) {
        if (rule[from] && !tx[to]) patch[to] = rule[from];
      }
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase
          .from("transactions")
          .update(patch as never)
          .eq("id", (row as any).transaction_id);

        if (upErr) throw new Error(upErr.message);
      }
    }

    const { error: stErr } = await supabase
      .from("classification_suggestions")
      .update({ status: data.accept ? "accepted" : "rejected" })
      .eq("id", data.id);
    if (stErr) throw new Error(stErr.message);
    return { ok: true };
  });

/** Transactions that a rule actually classified (newest first). */
export const listRuleApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ruleId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertEditor(context);
    const { data: rows, error } = await context.supabase
      .from("classification_applications")
      .select(
        "id, changed, previous, reverted_at, created_at, transaction:transactions(id, transaction_date, value_date, amount, payee, description, reference, account_id)",
      )
      .eq("rule_id", data.ruleId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Reverts one logged classification, or every non-reverted one of a rule. */
export const revertRuleApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; ruleId?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertEditor(context);
    const { supabase } = context;

    let q = supabase
      .from("classification_applications")
      .select("id, transaction_id, changed, previous")
      .is("reverted_at", null);
    if (data.id) q = q.eq("id", data.id);
    else if (data.ruleId) q = q.eq("rule_id", data.ruleId);
    else throw new Error("חסר מזהה");

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let reverted = 0;
    for (const row of rows ?? []) {
      const prev = ((row as any).previous ?? {}) as Record<string, string | null>;
      const changed = ((row as any).changed ?? {}) as Record<string, string>;
      const patch: Record<string, string | null> = {};
      for (const key of Object.keys(changed)) patch[key] = prev[key] ?? null;
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase
          .from("transactions")
          .update(patch as never)
          .eq("id", (row as any).transaction_id);
        if (upErr) throw new Error(upErr.message);
      }
      const { error: stErr } = await supabase
        .from("classification_applications")
        .update({ reverted_at: new Date().toISOString() })
        .eq("id", (row as any).id);
      if (stErr) throw new Error(stErr.message);
      reverted += 1;
    }
    return { reverted };
  });
