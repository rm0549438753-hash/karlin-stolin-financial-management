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
  .inputValidator((data: { forDate?: string } | undefined) => data ?? {})
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    try {
      const { runDailyChecksEmail } = await import("@/lib/checks-email.server");
      const result = await runDailyChecksEmail("manual", data?.forDate);
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
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteChecksEmailRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase.from("check_email_runs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rerunChecksEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { forDate?: string }) => data)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    try {
      const { runDailyChecksEmail } = await import("@/lib/checks-email.server");
      const result = await runDailyChecksEmail("manual", data?.forDate);
      return { ...result };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? String(err) };
    }
  });

export const getChecksEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("check_email_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateChecksEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    recipients: string[];
    subject_template: string;
    body_intro: string;
    body_outro: string;
    include_association: boolean;
    include_note: boolean;
    send_when_empty: boolean;
  }) => data)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { error } = await context.supabase
      .from("check_email_settings")
      .update({
        recipients: data.recipients,
        subject_template: data.subject_template,
        body_intro: data.body_intro,
        body_outro: data.body_outro,
        include_association: data.include_association,
        include_note: data.include_note,
        send_when_empty: data.send_when_empty,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const previewChecksEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { forDate?: string } | undefined) => data ?? {})
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { previewChecksEmail } = await import("@/lib/checks-email.server");
    return await previewChecksEmail(data?.forDate);
  });
