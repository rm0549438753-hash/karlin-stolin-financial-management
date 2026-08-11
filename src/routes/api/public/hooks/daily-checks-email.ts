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

export const Route = createFileRoute("/api/public/hooks/daily-checks-email")({
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
        // The daily checks email is now an ordinary row in email_automations
        // and is dispatched by the hourly-alerts job. This endpoint stays for
        // the existing cron schedule but no longer sends anything itself.
        return Response.json({ ok: true, skipped: "moved-to-email-automations" });
      },
    },
  },
});
