import { isFullViewer } from "@/lib/read-access";
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
      country: getRequestHeader("cf-ipcountry") ?? null,
      city: getRequestHeader("cf-ipcity") ?? null,
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
    if (!isAdmin && !isSuper && !(await isFullViewer(context))) throw new Error("Forbidden");
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
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const ip =
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const { verifyDownloadCode, downloadCodeThrottled, recordDownloadCodeFailure } = await import(
      "@/lib/security.server"
    );
    if (await downloadCodeThrottled(ip)) return { ok: false, required: true, throttled: true };
    const res = await verifyDownloadCode(data.code);
    if (!res.ok) {
      await recordDownloadCodeFailure(ip);
      // Constant-ish delay to blunt automated guessing.
      await new Promise((r) => setTimeout(r, 700));
    }
    return res;
  });

async function assertSuper(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
  if (!data) throw new Error("Forbidden");
}

/** Read-only gate: superadmin, or a full-viewer (guest) account. */
async function assertSuperRead(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "superadmin" });
  if (!data && !(await isFullViewer(context))) throw new Error("Forbidden");
}

/** Full security/login log with filters + paging (superadmin only). */
export const listSecurityEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
      search: z.string().max(120).nullable().optional(),
      eventType: z.string().max(30).nullable().optional(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(10).max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertSuperRead(context);
    const { listSecurityEvents: run } = await import("@/lib/security.server");
    return await run(data);
  });

export const securitySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperRead(context);
    const { securityEventSummary } = await import("@/lib/security.server");
    return await securityEventSummary();
  });

export const purgeSecurityLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const { purgeOldSecurityLogs } = await import("@/lib/security.server");
    return await purgeOldSecurityLogs();
  });

export const listBlockedIps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperRead(context);
    const { listBlockedIps: run } = await import("@/lib/security.server");
    return await run();
  });

export const blockIpAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ip: z.string().min(3).max(60), reason: z.string().max(200).nullable().optional() }))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const { blockIp } = await import("@/lib/security.server");
    return await blockIp(data.ip, data.reason ?? null, context.userId);
  });

export const unblockIpAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const { unblockIp } = await import("@/lib/security.server");
    return await unblockIp(data.id);
  });

/** Superadmin: reveal the current app download code. */
export const revealDownloadCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const { revealDownloadCode: run } = await import("@/lib/security.server");
    return await run();
  });

/** Records a logout / idle timeout for the authenticated caller. */
export const logSessionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ deviceKey: z.string().min(4).max(200), eventType: z.enum(["logout", "idle_logout"]) }),
  )
  .handler(async ({ data, context }) => {
    const { recordSessionEvent } = await import("@/lib/security.server");
    return await recordSessionEvent({
      userId: context.userId,
      email: (context.claims as any)?.email ?? null,
      ip: clientIp(),
      userAgent: getRequestHeader("user-agent") ?? null,
      deviceKey: data.deviceKey,
      eventType: data.eventType,
      country: getRequestHeader("cf-ipcountry") ?? null,
      city: getRequestHeader("cf-ipcity") ?? null,
    });
  });

/** Public: is the caller's IP blocked? */
export const checkIpBlocked = createServerFn({ method: "POST" }).handler(async () => {
  const { isIpBlocked } = await import("@/lib/security.server");
  return await isIpBlocked(clientIp());
});
