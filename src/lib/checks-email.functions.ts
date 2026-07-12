import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

export const triggerChecksEmailNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    try {
      const { runDailyChecksEmail } = await import("@/lib/checks-email.server");
      const result = await runDailyChecksEmail("manual");
      return { ...result };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  });

export const listChecksEmailRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("check_email_runs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
