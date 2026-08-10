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

export const Route = createFileRoute("/api/public/hooks/daily-security-audit")({
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
          const { runSecurityAudit } = await import("@/lib/security-audit.server");
          const result = await runSecurityAudit("cron");
          const { purgeOldSecurityLogs } = await import("@/lib/security.server");
          const purged = await purgeOldSecurityLogs().catch(() => null);
          return Response.json({ ...result, purged });
        } catch (err: any) {
          console.error("[daily-security-audit] failed:", err);
          const { recordAuditFailure } = await import("@/lib/security-audit.server");
          await recordAuditFailure("cron", err);
          return new Response(
            JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
