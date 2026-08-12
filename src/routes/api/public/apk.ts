import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "app-downloads";
const OBJECT = "app-debug.apk";

export const Route = createFileRoute("/api/public/apk")({
  server: {
    handlers: {
      // Direct download link for the Android app.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        const { verifyDownloadCode, downloadCodeThrottled, recordDownloadCodeFailure } = await import(
          "@/lib/security.server"
        );
        if (await downloadCodeThrottled(ip)) {
          return new Response("יותר מדי ניסיונות — נסה שוב בעוד כמה דקות", { status: 429 });
        }
        const check = await verifyDownloadCode(url.searchParams.get("code") ?? "");
        if (!check.ok) {
          await recordDownloadCodeFailure(ip);
          return new Response("קוד הורדה שגוי", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(OBJECT);
        if (error || !data) {
          return new Response("APK not available yet", { status: 404 });
        }
        return new Response(await data.arrayBuffer(), {
          headers: {
            "Content-Type": "application/vnd.android.package-archive",
            "Content-Disposition": `attachment; filename="karlin-stolin.apk"`,
            "Cache-Control": "no-store",
          },
        });
      },

      // Upload endpoint used by the GitHub Actions build. Token protected.
      POST: async ({ request }) => {
        const token = process.env["APK_UPLOAD_TOKEN"];
        const provided = request.headers.get("x-upload-token");
        if (!token || provided !== token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = await request.arrayBuffer();
        if (body.byteLength === 0) {
          return new Response("Empty body", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(OBJECT, body, {
            upsert: true,
            contentType: "application/vnd.android.package-archive",
          });

        if (error) {
          return new Response(`Upload failed: ${error.message}`, { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
