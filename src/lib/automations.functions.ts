import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("אין הרשאה");
}

/** Renders an automation with live data without sending anything. */
export const previewAutomationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { previewAutomation } = await import("@/lib/automations.server");
    return await previewAutomation(data.id);
  });

/** Sends a single automation right now, ignoring its schedule. */
export const sendAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runEmailAutomations } = await import("@/lib/automations.server");
    return await runEmailAutomations("manual", { automationId: data.id, force: true });
  });
