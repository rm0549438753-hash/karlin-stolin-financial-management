import { createFileRoute } from "@tanstack/react-router";

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/public/hooks/daily-checks-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.CRON_HOOK_SECRET;
        if (!expected || !provided || !timingSafeEq(provided, expected)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { runDailyChecksEmail } = await import("@/lib/checks-email.server");
          const result = await runDailyChecksEmail("cron");
          return Response.json(result);
        } catch (err: any) {
          console.error("[daily-checks-email] failed:", err);
          return new Response(
            JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
