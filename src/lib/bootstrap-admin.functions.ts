import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// One-shot bootstrap: creates the first admin user when there are no users yet.
// Becomes a no-op once any user exists.
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (listErr) throw new Error(listErr.message);
    if ((list?.users?.length ?? 0) > 0) {
      throw new Error("Users already exist; bootstrap disabled.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.email },
    });
    if (error) throw new Error(error.message);
    const userId = created.user!.id;

    await supabaseAdmin.from("profiles").upsert({ id: userId, email: data.email, full_name: data.email });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });

    return { ok: true, userId };
  });
