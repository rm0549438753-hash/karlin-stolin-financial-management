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
  const { data, error } = await supabaseAdmin
    .schema("private" as any)
    .from("cron_secrets")
    .select("value")
    .eq("name", "hook")
    .maybeSingle();
  if (error || !data?.value) return false;
  return timingSafeEq(provided, data.value as string);
}

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
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
          const body = await request.json().catch(() => ({})) as { resumeOnly?: boolean };
          const { runBackup, resumePendingBackup } = await import("@/lib/backup.server");
          const result = body.resumeOnly
            ? await resumePendingBackup()
            : await runBackup("cron");
          return Response.json({ ...result });
        } catch (err: any) {
          console.error("[daily-backup] failed:", err);
          return new Response(
            JSON.stringify({ ok: false, error: err?.message ?? String(err) }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
