import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const triggerBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the run row synchronously so the UI has a row to poll.
    const { data: run, error } = await supabaseAdmin
      .from("backup_runs")
      .insert({ status: "running", triggered_by: "manual" })
      .select("id")
      .single();
    if (error || !run) throw new Error(error?.message ?? "Could not create run");

    // Process only a bounded batch. Further batches are resumed by the UI and cron.
    const { runBackup } = await import("@/lib/backup.server");
    try {
      const result = await runBackup("manual", run.id);
      return { ...result, ok: result.status !== "failed" };
    } catch (err: any) {
      return { ok: false, runId: run.id, error: err?.message ?? String(err) };
    }
  });

export const continueBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { resumePendingBackup } = await import("@/lib/backup.server");
    return await resumePendingBackup();
  });

export const listBackupRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("backup_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteBackupRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("backup_runs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
