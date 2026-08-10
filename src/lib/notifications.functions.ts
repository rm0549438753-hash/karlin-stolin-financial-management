import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Recomputes the alert signals and fans them out to admins/editors.
 * Reads are done straight from the browser through RLS; only generation needs
 * elevated access, so it lives here.
 */
export const refreshNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isEditor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "editor",
    });
    if (!isAdmin && !isEditor) return { created: 0, signals: 0 };

    const { generateNotifications } = await import("@/lib/notifications.server");
    return await generateNotifications();
  });
