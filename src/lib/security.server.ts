import { createClient } from "@supabase/supabase-js";

const SENDER = "RM0549438753@gmail.com";

function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildEmail(subject: string, html: string, toList: string[], from: string): string {
  const boundary = "----=_Part_" + Math.random().toString(36).slice(2);
  const subjectEncoded = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const headers = [
    `From: ${from}`,
    `To: ${toList.join(", ")}`,
    `Subject: ${subjectEncoded}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(html))),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return base64UrlEncode(new TextEncoder().encode(headers));
}

async function sendMail(subject: string, html: string, to: string[]) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) return;
  const raw = buildEmail(subject, html, to, SENDER);
  await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmailKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ilTime(d = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/* ------------------------------------------------------------------ */
/* Reversible encryption (AES-GCM) for the app download code           */
/* ------------------------------------------------------------------ */

async function encKey(): Promise<CryptoKey> {
  const secret = process.env.APP_CODE_ENC_KEY;
  if (!secret) throw new Error("Missing APP_CODE_ENC_KEY");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encryptText(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encKey();
  const buf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${b64(iv)}.${b64(new Uint8Array(buf))}`;
}

async function decryptText(cipher: string): Promise<string | null> {
  try {
    const [ivPart, dataPart] = cipher.split(".");
    if (!ivPart || !dataPart) return null;
    const key = await encKey();
    const buf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(ivPart) },
      key,
      unb64(dataPart),
    );
    return new TextDecoder().decode(buf);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Login lockout                                                       */
/* ------------------------------------------------------------------ */

const LOCK_WINDOW_MIN = 15;
const MAX_FAILS = 5;

export async function isLockedOut(email: string) {
  const admin = adminClient();
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("failed_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", email.trim().toLowerCase())
    .gte("created_at", since);
  const fails = count ?? 0;
  return { locked: fails >= MAX_FAILS, fails, remaining: Math.max(0, MAX_FAILS - fails), windowMinutes: LOCK_WINDOW_MIN };
}

export async function recordFailedLogin(email: string, ip: string | null) {
  const admin = adminClient();
  const clean = email.trim().toLowerCase();
  await admin.from("failed_login_attempts").insert({ email: clean, ip });
  const status = await isLockedOut(clean);
  if (status.fails === MAX_FAILS) {
    await admin.from("login_events").insert({
      email: clean,
      ip,
      event_type: "lockout",
      is_new_device: false,
    });
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
      <h2>חשבון ננעל עקב ניסיונות התחברות כושלים</h2>
      <ul style="list-style:none;padding:0">
        <li><b>חשבון:</b> ${escapeHtml(clean)}</li>
        <li><b>מועד:</b> ${escapeHtml(ilTime())}</li>
        <li><b>כתובת IP:</b> ${escapeHtml(ip ?? "לא ידוע")}</li>
        <li><b>מספר ניסיונות:</b> ${MAX_FAILS}</li>
      </ul>
      <p>החשבון נעול ל-${LOCK_WINDOW_MIN} דקות. אם זה לא פעולה מוכרת — מומלץ לחסום את כתובת ה-IP במסך "אבטחה וגישה".</p>
    </div>`;
    await sendMail("חשבון ננעל – מרכז קארלין סטולין", html, [SENDER]);
  }
  return status;
}

export async function clearFailedLogins(email: string) {
  const admin = adminClient();
  await admin.from("failed_login_attempts").delete().eq("email", email.trim().toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Blocked IPs                                                         */
/* ------------------------------------------------------------------ */

export async function isIpBlocked(ip: string | null) {
  if (!ip) return { blocked: false };
  const admin = adminClient();
  const { data } = await admin.from("blocked_ips").select("id").eq("ip", ip).maybeSingle();
  return { blocked: !!data };
}

export async function listBlockedIps() {
  const admin = adminClient();
  const { data, error } = await admin
    .from("blocked_ips")
    .select("id, ip, reason, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function blockIp(ip: string, reason: string | null, userId: string) {
  const admin = adminClient();
  const { error } = await admin
    .from("blocked_ips")
    .upsert({ ip: ip.trim(), reason, created_by: userId }, { onConflict: "ip" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function unblockIp(id: string) {
  const admin = adminClient();
  const { error } = await admin.from("blocked_ips").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Security events                                                     */
/* ------------------------------------------------------------------ */

/** Coarse browser/OS signature — stable across cache clears and private mode. */
function uaSignature(ua: string | null): string | null {
  if (!ua) return null;
  const os =
    /Windows/i.test(ua) ? "Windows" :
    /Android/i.test(ua) ? "Android" :
    /iPhone|iPad|iPod/i.test(ua) ? "iOS" :
    /Mac OS X/i.test(ua) ? "macOS" :
    /Linux/i.test(ua) ? "Linux" : "Other";
  const browser =
    /Edg\//i.test(ua) ? "Edge" :
    /OPR\//i.test(ua) ? "Opera" :
    /Chrome\//i.test(ua) ? "Chrome" :
    /Firefox\//i.test(ua) ? "Firefox" :
    /Safari\//i.test(ua) ? "Safari" : "Other";
  return `${os}/${browser}`;
}

export async function recordLoginEvent(params: {
  userId: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  deviceKey: string;
  country?: string | null;
  city?: string | null;
}) {
  const admin = adminClient();

  // A device counts as familiar when the stored key was seen before OR when
  // this user already signed in from the same browser/OS combination. Without
  // the second check every cleared cookie jar or private window looked new and
  // triggered another alert email.
  const { data: history } = await admin
    .from("login_events")
    .select("device_key,user_agent,created_at")
    .eq("user_id", params.userId)
    .eq("event_type", "login")
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = history ?? [];
  const sig = uaSignature(params.userAgent);
  const knownByKey = rows.some((r: any) => r.device_key === params.deviceKey);
  const knownBySignature = sig ? rows.some((r: any) => uaSignature(r.user_agent) === sig) : false;
  const isNewDevice = !knownByKey && !knownBySignature;

  await admin.from("login_events").insert({
    user_id: params.userId,
    email: params.email,
    ip: params.ip,
    user_agent: params.userAgent,
    device_key: params.deviceKey,
    is_new_device: isNewDevice,
    event_type: "login",
    country: params.country ?? null,
    city: params.city ?? null,
  });
  await clearFailedLogins(params.email ?? "");

  // Throttle: at most one new-device email per user per day.
  let recentlyAlerted = false;
  if (isNewDevice) {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    
    const { count } = await admin
      .from("login_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", params.userId)
      .eq("is_new_device", true)
      .eq("event_type", "login")
      .gte("created_at", dayAgo);
    recentlyAlerted = (count ?? 0) > 1; // the row we just inserted counts as 1
  }

  if (isNewDevice && !recentlyAlerted && params.email) {
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
      <h2>התחברות ממכשיר חדש</h2>
      <p>זוהתה כניסה למערכת מרכז קארלין סטולין ממכשיר או דפדפן שלא נראו קודם.</p>
      <ul style="list-style:none;padding:0">
        <li><b>משתמש:</b> ${escapeHtml(params.email)}</li>
        <li><b>מועד:</b> ${escapeHtml(ilTime())}</li>
        <li><b>כתובת IP:</b> ${escapeHtml(params.ip ?? "לא ידוע")}</li>
        <li><b>מיקום:</b> ${escapeHtml([params.city, params.country].filter(Boolean).join(", ") || "לא ידוע")}</li>
        <li><b>דפדפן:</b> ${escapeHtml(params.userAgent ?? "לא ידוע")}</li>
      </ul>
      <p>אם זה לא אתה — יש לשנות סיסמה מיד ולפנות למנהל המערכת.</p>
    </div>`;
    await sendMail("התחברות ממכשיר חדש – מרכז קארלין סטולין", html, [params.email, SENDER]);
  }

  return { ok: true, isNewDevice };
}


/** Records logout / idle-timeout events. */
export async function recordSessionEvent(params: {
  userId: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  deviceKey: string;
  eventType: "logout" | "idle_logout";
  country?: string | null;
  city?: string | null;
}) {
  const admin = adminClient();
  await admin.from("login_events").insert({
    user_id: params.userId,
    email: params.email,
    ip: params.ip,
    user_agent: params.userAgent,
    device_key: params.deviceKey,
    is_new_device: false,
    event_type: params.eventType,
    country: params.country ?? null,
    city: params.city ?? null,
  });
  return { ok: true };
}

export type SecurityEventFilters = {
  from?: string | null;
  to?: string | null;
  search?: string | null;
  eventType?: string | null;
  page?: number;
  pageSize?: number;
};

export async function listSecurityEvents(f: SecurityEventFilters) {
  const admin = adminClient();
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(500, Math.max(10, f.pageSize ?? 50));
  const wantFailed = !f.eventType || f.eventType === "all" || f.eventType === "failed";
  const wantLogin = !f.eventType || f.eventType === "all" || f.eventType !== "failed";

  const rows: any[] = [];

  if (wantLogin) {
    let q = admin
      .from("login_events")
      .select("id,email,ip,user_agent,is_new_device,created_at,event_type,country,city")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (f.from) q = q.gte("created_at", f.from);
    if (f.to) q = q.lte("created_at", f.to);
    if (f.eventType && f.eventType !== "all" && f.eventType !== "failed") q = q.eq("event_type", f.eventType);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }

  if (wantFailed) {
    let q = admin
      .from("failed_login_attempts")
      .select("id,email,ip,created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (f.from) q = q.gte("created_at", f.from);
    if (f.to) q = q.lte("created_at", f.to);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(
      ...(data ?? []).map((r) => ({
        ...r,
        user_agent: null,
        is_new_device: false,
        event_type: "failed",
        country: null,
        city: null,
      })),
    );
  }

  const term = (f.search ?? "").trim().toLowerCase();
  const filtered = term
    ? rows.filter(
        (r) =>
          (r.email ?? "").toLowerCase().includes(term) ||
          (r.ip ?? "").toLowerCase().includes(term) ||
          (r.city ?? "").toLowerCase().includes(term) ||
          (r.country ?? "").toLowerCase().includes(term),
      )
    : rows;

  filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return { rows: filtered.slice(start, start + pageSize), total, page, pageSize };
}

export async function securityEventSummary() {
  const admin = adminClient();
  const now = Date.now();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now - 7 * 24 * 3600_000).toISOString();
  const dayAgo = new Date(now - 24 * 3600_000).toISOString();

  const [{ count: todayLogins }, { data: weekRows }, { count: failed24 }, { count: newDevices }] =
    await Promise.all([
      admin
        .from("login_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "login")
        .gte("created_at", dayStart.toISOString()),
      admin.from("login_events").select("user_id").eq("event_type", "login").gte("created_at", weekAgo),
      admin.from("failed_login_attempts").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
      admin
        .from("login_events")
        .select("id", { count: "exact", head: true })
        .eq("is_new_device", true)
        .gte("created_at", weekAgo),
    ]);

  const activeUsers = new Set((weekRows ?? []).map((r: any) => r.user_id).filter(Boolean)).size;
  return {
    todayLogins: todayLogins ?? 0,
    activeUsersWeek: activeUsers,
    failed24h: failed24 ?? 0,
    newDevicesWeek: newDevices ?? 0,
  };
}

/** Deletes login history older than 12 months. */
export async function purgeOldSecurityLogs() {
  const admin = adminClient();
  const cutoff = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();
  const a = await admin.from("login_events").delete().lt("created_at", cutoff).select("id");
  const b = await admin.from("failed_login_attempts").delete().lt("created_at", cutoff).select("id");
  return { loginEventsDeleted: a.data?.length ?? 0, failedDeleted: b.data?.length ?? 0 };
}

/* ------------------------------------------------------------------ */
/* App download code                                                   */
/* ------------------------------------------------------------------ */

export async function setDownloadCode(code: string, userId: string) {
  const admin = adminClient();
  const clean = (code ?? "").trim();
  const code_hash = clean ? await sha256Hex(clean) : null;
  const code_cipher = clean ? await encryptText(clean) : null;
  await admin
    .from("app_download_settings")
    .update({ code_hash, code_cipher, updated_by: userId })
    .eq("singleton", true);
  return { ok: true, enabled: !!code_hash };
}

export async function revealDownloadCode() {
  const admin = adminClient();
  const { data } = await admin
    .from("app_download_settings")
    .select("code_hash, code_cipher")
    .eq("singleton", true)
    .maybeSingle();
  if (!data?.code_hash) return { required: false, code: null as string | null, legacy: false };
  if (!data.code_cipher) return { required: true, code: null as string | null, legacy: true };
  return { required: true, code: await decryptText(data.code_cipher), legacy: false };
}

/**
 * Brute-force guard for the APK download code: max 10 wrong attempts per IP
 * per 10 minutes. Attempts are recorded in failed_login_attempts (email is
 * namespaced with "apk:" so it never collides with real accounts).
 */
export async function downloadCodeThrottled(ip: string | null) {
  const admin = adminClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("failed_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", `apk:${ip ?? "unknown"}`)
    .gte("created_at", since);
  return (count ?? 0) >= 10;
}

export async function recordDownloadCodeFailure(ip: string | null) {
  const admin = adminClient();
  await admin.from("failed_login_attempts").insert({ email: `apk:${ip ?? "unknown"}`, ip });
}

export async function verifyDownloadCode(code: string) {
  const admin = adminClient();
  const { data } = await admin.from("app_download_settings").select("code_hash").eq("singleton", true).maybeSingle();
  const hash = data?.code_hash ?? null;
  if (!hash) return { ok: true, required: false };
  const given = await sha256Hex((code ?? "").trim());
  return { ok: given === hash, required: true };
}

export async function isDownloadCodeRequired() {
  const admin = adminClient();
  const { data } = await admin.from("app_download_settings").select("code_hash").eq("singleton", true).maybeSingle();
  return { required: !!data?.code_hash };
}

/* ------------------------------------------------------------------ */
/* Guest link throttling                                               */
/* ------------------------------------------------------------------ */

const GUEST_WINDOW_MIN = 10;
const GUEST_MAX_FAILS = 5;

/**
 * Brute-force guard for the read-only guest link: max 5 wrong tokens per IP
 * per 10 minutes. Reuses failed_login_attempts (email namespaced "guest:")
 * and honours the blocked_ips list, exactly like the regular login path.
 */
export async function guestLoginThrottled(ip: string | null) {
  if ((await isIpBlocked(ip)).blocked) return true;
  const admin = adminClient();
  const since = new Date(Date.now() - GUEST_WINDOW_MIN * 60_000).toISOString();
  const { count } = await admin
    .from("failed_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", `guest:${ip ?? "unknown"}`)
    .gte("created_at", since);
  return (count ?? 0) >= GUEST_MAX_FAILS;
}

export async function recordGuestLoginFailure(ip: string | null) {
  const admin = adminClient();
  await admin.from("failed_login_attempts").insert({ email: `guest:${ip ?? "unknown"}`, ip });
}

export async function clearGuestLoginFailures(ip: string | null) {
  const admin = adminClient();
  await admin.from("failed_login_attempts").delete().eq("email", `guest:${ip ?? "unknown"}`);
}
