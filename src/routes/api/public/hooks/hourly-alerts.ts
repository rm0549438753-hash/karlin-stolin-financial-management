import { createFileRoute } from "@tanstack/react-router";

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyCronSecret(provided: string | null | undefined): Promise<boolean> {
  if (!provided) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_cron_hook_secret");
  if (error || !data) return false;
  return timingSafeEq(provided, data as string);
}

/**
 * Hourly job: refreshes the in-app notification bell and fires any email
 * automation whose schedule matches the current Israel hour.
 */
export const Route = createFileRoute("/api/public/hooks/hourly-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!(await verifyCronSecret(provided))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const [{ generateNotifications }, { runEmailAutomations }] = await Promise.all([
            import("@/lib/notifications.server"),
            import("@/lib/automations.server"),
          ]);
          const notifications = await generateNotifications();
          const automations = await runEmailAutomations("cron");
          return Response.json({ ok: true, notifications, automations });
        } catch (err: any) {
          console.error("[hourly-alerts] failed:", err);
          return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
