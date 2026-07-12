import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const triggerBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the run row synchronously so the UI has a row to poll.
    const { data: run, error } = await supabaseAdmin
      .from("backup_runs")
      .insert({ status: "running", triggered_by: "manual" })
      .select("id")
      .single();
    if (error || !run) throw new Error(error?.message ?? "Could not create run");

    // Run the actual backup and wait for completion (surface success/failure
    // in this response). Errors are also persisted in backup_runs.
    const { runBackup } = await import("@/lib/backup.server");
    try {
      const result = await runBackup("manual", run.id);
      return { ok: true, ...result };
    } catch (err: any) {
      return { ok: false, runId: run.id, error: err?.message ?? String(err) };
    }
  });

export const listBackupRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("backup_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
