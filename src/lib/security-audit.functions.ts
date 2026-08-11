import { isFullViewer } from "@/lib/read-access";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

async function assertAdminRead(ctx: any) {
  try { await assertAdmin(ctx); return; } catch { /* fall through to full-viewer */ }
  if (!(await isFullViewer(ctx))) throw new Error("Forbidden");
}

export const triggerSecurityAuditNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runSecurityAudit, recordAuditFailure } = await import(
      "@/lib/security-audit.server"
    );
    try {
      return await runSecurityAudit("manual");
    } catch (err) {
      await recordAuditFailure("manual", err);
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

export const autofixSecurityConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("security_config_autofix" as any);
    if (error) throw new Error(error.message);
    const applied = (data as string[]) ?? [];
    const { runSecurityAudit } = await import("@/lib/security-audit.server");
    const rescan = await runSecurityAudit("manual").catch(() => null);
    return { ok: true, applied, rescan };
  });

export const listSecurityAuditRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRead(context);
    const { data, error } = await context.supabase
      .from("security_audit_runs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteSecurityAuditRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("security_audit_runs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
