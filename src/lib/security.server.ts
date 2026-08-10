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
  await admin.from("failed_login_attempts").insert({ email: email.trim().toLowerCase(), ip });
  return await isLockedOut(email);
}

export async function clearFailedLogins(email: string) {
  const admin = adminClient();
  await admin.from("failed_login_attempts").delete().eq("email", email.trim().toLowerCase());
}

export async function recordLoginEvent(params: {
  userId: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  deviceKey: string;
}) {
  const admin = adminClient();
  const { count } = await admin
    .from("login_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("device_key", params.deviceKey);
  const isNewDevice = (count ?? 0) === 0;

  await admin.from("login_events").insert({
    user_id: params.userId,
    email: params.email,
    ip: params.ip,
    user_agent: params.userAgent,
    device_key: params.deviceKey,
    is_new_device: isNewDevice,
  });
  await clearFailedLogins(params.email ?? "");

  if (isNewDevice && params.email) {
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right">
      <h2>התחברות ממכשיר חדש</h2>
      <p>זוהתה כניסה למערכת מרכז קארלין סטולין ממכשיר או דפדפן שלא נראו קודם.</p>
      <ul style="list-style:none;padding:0">
        <li><b>משתמש:</b> ${escapeHtml(params.email)}</li>
        <li><b>מועד:</b> ${escapeHtml(ilTime())}</li>
        <li><b>כתובת IP:</b> ${escapeHtml(params.ip ?? "לא ידוע")}</li>
        <li><b>דפדפן:</b> ${escapeHtml(params.userAgent ?? "לא ידוע")}</li>
      </ul>
      <p>אם זה לא אתה — יש לשנות סיסמה מיד ולפנות למנהל המערכת.</p>
    </div>`;
    await sendMail("התחברות ממכשיר חדש – מרכז קארלין סטולין", html, [params.email, SENDER]);
  }

  return { ok: true, isNewDevice };
}

export async function setDownloadCode(code: string, userId: string) {
  const admin = adminClient();
  const code_hash = code ? await sha256Hex(code.trim()) : null;
  await admin
    .from("app_download_settings")
    .update({ code_hash, updated_by: userId })
    .eq("singleton", true);
  return { ok: true, enabled: !!code_hash };
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
