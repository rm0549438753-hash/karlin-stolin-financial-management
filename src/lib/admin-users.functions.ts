import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isSuperAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "superadmin",
  });
  return !!data;
}

async function assertAdmin(context: any) {
  if (await isSuperAdmin(context)) return;
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Forbidden");
}

/**
 * A plain admin must never be able to act on a superadmin account (delete it,
 * block it, reset its password) — that would be a path to taking over the
 * highest-privilege role. Only a superadmin may target another superadmin.
 */
async function assertMayTargetUser(context: any, targetUserId: string) {
  if (await isSuperAdmin(context)) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("role", "superadmin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) throw new Error("Forbidden: רק מנהל-על יכול לנהל חשבון מנהל-על");
}


export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email(),
      password: z.string().min(10, "הסיסמה חייבת להכיל לפחות 10 תווים"),
      fullName: z.string().optional().default(""),
      role: z.enum(["superadmin", "admin", "editor", "viewer"]).default("editor"),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.role === "superadmin" && !(await isSuperAdmin(context))) {
      throw new Error("Forbidden: רק מנהל-על יכול להעניק תפקיד מנהל-על");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName || data.email },
    });
    if (error) throw new Error(error.message);

    const userId = created.user!.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const roleRows =
      data.role === "superadmin"
        ? [{ user_id: userId, role: "superadmin" }, { user_id: userId, role: "admin" }]
        : [{ user_id: userId, role: data.role }];
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert(roleRows as any);
    if (roleInsertErr) throw new Error(roleInsertErr.message);

    // Ensure a profile row exists (no DB trigger on auth.users in this project)
    await supabaseAdmin.from("profiles").upsert(
      { id: userId, email: data.email, full_name: data.fullName || data.email, blocked: false },
      { onConflict: "id" },
    );

    return { ok: true, userId };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const all: any[] = [];
    let page = 1;
    // paginate auth users
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      all.push(...data.users);
      if (data.users.length < 200) break;
      page++;
    }

    const ids = all.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, blocked").in("id", ids);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids);
    const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    // Backfill missing profile rows so UI/permissions stay consistent
    const missing = all.filter((u) => !profById.has(u.id));
    if (missing.length > 0) {
      await supabaseAdmin.from("profiles").upsert(
        missing.map((u) => ({
          id: u.id,
          email: u.email ?? "",
          full_name: (u.user_metadata as any)?.full_name ?? u.email ?? "",
          blocked: !!(u as any).banned_until,
        })),
        { onConflict: "id" },
      );
    }

    return all.map((u) => {
      const p = profById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        full_name: p?.full_name ?? (u.user_metadata as any)?.full_name ?? u.email ?? "",
        blocked: p?.blocked ?? !!(u as any).banned_until,
        roles: rolesByUser.get(u.id) ?? [],
      };
    });
  });


export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("לא ניתן למחוק את עצמך");
    await assertMayTargetUser(context, data.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), blocked: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("לא ניתן לחסום את עצמך");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876600h" : "none",
    });
    if (error) throw new Error(error.message);
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({ blocked: data.blocked })
      .eq("id", data.userId);
    if (profErr) throw new Error(profErr.message);
    return { ok: true };
  });

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      password: z.string().min(10, "הסיסמה חייבת להכיל לפחות 10 תווים").max(72),
    }),
  )
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden: רק מנהל-על יכול לשנות סיסמאות");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ email: z.string().email(), redirectTo: z.string().url() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Superadmin: revoke all active sessions of a user (sign out everywhere). */
export const adminSignOutUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    if (!(await isSuperAdmin(context))) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.auth.admin as any).signOut(data.userId, "global");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
