import { createFileRoute } from "@tanstack/react-router";

// Temporary maintenance endpoint: provisions the read-only guest account.
export const Route = createFileRoute("/api/public/setup-guest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("s") !== process.env["GUEST_LINK_TOKEN"]) {
          return new Response("no", { status: 401 });
        }
        const email = process.env["GUEST_DEMO_EMAIL"]!;
        const password = process.env["GUEST_DEMO_PASSWORD"]!;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        let user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (user) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password,
            email_confirm: true,
            ban_duration: "none",
          });
        } else {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: "אורח צפייה" },
          });
          if (error) return new Response(error.message, { status: 500 });
          user = created.user!;
        }

        await (supabaseAdmin as any)
          .from("profiles")
          .upsert({ id: user.id, email, full_name: "אורח צפייה", full_view: true, blocked: false }, { onConflict: "id" });
        await (supabaseAdmin as any).from("user_roles").delete().eq("user_id", user.id);

        return Response.json({ ok: true, id: user.id });
      },
    },
  },
});
