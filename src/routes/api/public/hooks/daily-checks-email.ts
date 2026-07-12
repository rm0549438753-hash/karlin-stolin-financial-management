import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-checks-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
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
