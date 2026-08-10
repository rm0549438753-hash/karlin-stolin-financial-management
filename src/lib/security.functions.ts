import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function clientIp(): string | null {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

/** Records a successful login for the authenticated caller. */
export const logLoginEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ deviceKey: z.string().min(4).max(200) }))
  .handler(async ({ data, context }) => {
    const { recordLoginEvent } = await import("@/lib/security.server");
    const email = (context.claims as any)?.email ?? null;
    return await recordLoginEvent({
      userId: context.userId,
      email,
      ip: clientIp(),
      userAgent: getRequestHeader("user-agent") ?? null,
      deviceKey: data.deviceKey,
    });
  });

/** Public: check whether an email is temporarily locked out. */
export const checkLoginLockout = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const { isLockedOut } = await import("@/lib/security.server");
    return await isLockedOut(data.email);
  });

/** Public: record a failed sign-in attempt. */
export const reportFailedLogin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const { recordFailedLogin } = await import("@/lib/security.server");
    return await recordFailedLogin(data.email, clientIp());
  });

export const listLoginEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("login_events")
      .select("id,email,ip,user_agent,is_new_device,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveDownloadCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ code: z.string().max(64) }))
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
    if (!isSuper) throw new Error("Forbidden");
    const { setDownloadCode } = await import("@/lib/security.server");
    return await setDownloadCode(data.code, context.userId);
  });

export const getDownloadCodeStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isDownloadCodeRequired } = await import("@/lib/security.server");
  return await isDownloadCodeRequired();
});

export const checkDownloadCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().max(64) }))
  .handler(async ({ data }) => {
    const { verifyDownloadCode } = await import("@/lib/security.server");
    return await verifyDownloadCode(data.code);
  });
