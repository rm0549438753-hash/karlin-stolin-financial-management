import { createClient } from "@supabase/supabase-js";

const SENDER = "RM0549438753@gmail.com";
const DEFAULT_RECIPIENTS = ["RM0549438753@gmail.com", "5326725@gmail.com"];
const ORG_NAME = "מרכז קארלין סטולין";

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function tomorrowInIsrael(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const t = new Date(Date.UTC(y, m - 1, d) + 24 * 60 * 60 * 1000);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtIL(dateISO: string): string {
  const [y, m, d] = dateISO.split("-");
  return `${d}/${m}/${y}`;
}

function dayNameHe(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `יום ${HEBREW_DAYS[dt.getUTCDay()]}`;
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(n);
}

function escapeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyPlaceholders(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? "");
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
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
  const bytes = new TextEncoder().encode(headers);
  return base64UrlEncode(bytes);
}

interface Settings {
  recipients: string[];
  subject_template: string;
  body_intro: string;
  body_outro: string;
  include_association: boolean;
  include_note: boolean;
  send_when_empty: boolean;
}

function renderHtml(dateISO: string, rows: any[], total: number, s: Settings, vars: Record<string, string>): string {
  const introHtml = escapeHtml(applyPlaceholders(s.body_intro, vars)).replace(/\n/g, "<br>");
  const outroHtml = escapeHtml(applyPlaceholders(s.body_outro, vars)).replace(/\n/g, "<br>");

  const headers = ['<th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">שם</th>'];
  if (s.include_association) headers.push('<th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">עמותה</th>');
  headers.push('<th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">סכום</th>');
  if (s.include_note) headers.push('<th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">הערה</th>');

  const tableRows = rows.map((r, i) => {
    const cells = [`<td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.payee || r.description || "—")}</td>`];
    if (s.include_association) cells.push(`<td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.association || "—")}</td>`);
    cells.push(`<td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;white-space:nowrap;">${fmtAmount(Math.abs(Number(r.amount) || 0))}</td>`);
    if (s.include_note) cells.push(`<td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.note || r.reference || "")}</td>`);
    return `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"};">${cells.join("")}</tr>`;
  }).join("");

  const totalCols = 1 + (s.include_association ? 1 : 0);
  const trailCols = s.include_note ? 1 : 0;

  const bodyContent = rows.length === 0
    ? `<p style="font-size:15px;margin:16px 0;">אין צ'קים לפירעון בתאריך זה.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <thead><tr style="background:#0b1e3f;color:#ffffff;">${headers.join("")}</tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr style="background:#fef3c7;">
            <td colspan="${totalCols}" style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">סה"כ</td>
            <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">${fmtAmount(total)}</td>
            ${trailCols ? `<td style="padding:10px 12px;border:1px solid #e2e8f0;">${rows.length} צ'קים</td>` : ""}
          </tr>
        </tfoot>
      </table>`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;padding:24px;">
    <div style="background:#0b1e3f;color:#f5c243;padding:20px 24px;border-radius:12px 12px 0 0;">
      <div style="font-size:22px;font-weight:700;">${escapeHtml(ORG_NAME)}</div>
      <div style="font-size:14px;opacity:0.9;margin-top:4px;">התראה יומית · צ'קים לפירעון</div>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
      <p style="font-size:15px;margin:0 0 12px;line-height:1.6;">${introHtml}</p>
      ${bodyContent}
      <p style="font-size:15px;margin:16px 0 0;line-height:1.6;">${outroHtml}</p>
      <p style="font-size:12px;color:#64748b;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;">
        הודעה זו נשלחה אוטומטית ממערכת הניהול הפיננסי של ${escapeHtml(ORG_NAME)}.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function loadSettings(admin: any): Promise<Settings> {
  const { data } = await admin.from("check_email_settings").select("*").eq("singleton", true).maybeSingle();
  return {
    recipients: data?.recipients?.length ? data.recipients : DEFAULT_RECIPIENTS,
    subject_template: data?.subject_template ?? 'צ\'קים לפירעון {{day_name}} {{date}} — {{count}} צ\'קים, סה"כ {{total}}',
    body_intro: data?.body_intro ?? "שלום,\nלהלן פירוט הצ'קים הצפויים להיפרע {{day_name}} {{date}}:",
    body_outro: data?.body_outro ?? "בברכה,\n{{org_name}}",
    include_association: data?.include_association ?? true,
    include_note: data?.include_note ?? true,
    send_when_empty: data?.send_when_empty ?? false,
  };
}

async function fetchChecksForDate(admin: any, forDate: string) {
  const { data: acc, error: accErr } = await admin
    .from("accounts")
    .select("id")
    .eq("schema_type", "checks")
    .maybeSingle();
  if (accErr) throw new Error(`accounts: ${accErr.message}`);
  if (!acc) return { rows: [], noAccount: true };

  const { data: rows, error: txErr } = await admin
    .from("transactions")
    .select("payee,description,association,amount,note,reference,value_date")
    .eq("account_id", acc.id)
    .eq("value_date", forDate)
    .order("payee", { ascending: true });
  if (txErr) throw new Error(`transactions: ${txErr.message}`);
  return { rows: rows ?? [], noAccount: false };
}

export async function previewChecksEmail(forDate?: string) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const settings = await loadSettings(admin);
  const date = forDate ?? tomorrowInIsrael();
  const { rows } = await fetchChecksForDate(admin, date);
  const total = rows.reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0);

  const vars = {
    date: fmtIL(date),
    day_name: dayNameHe(date),
    count: String(rows.length),
    total: fmtAmount(total),
    org_name: ORG_NAME,
  };
  const subject = applyPlaceholders(settings.subject_template, vars);
  const html = renderHtml(date, rows, total, settings, vars);
  return { subject, html, recipients: settings.recipients, sender: SENDER, count: rows.length, total, for_date: date };
}

export async function runDailyChecksEmail(triggeredBy: "cron" | "manual", forDateOverride?: string) {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const settings = await loadSettings(admin);
  const forDate = forDateOverride ?? tomorrowInIsrael();

  const { rows, noAccount } = await fetchChecksForDate(admin, forDate);
  if (noAccount) {
    await admin.from("check_email_runs").insert({
      for_date: forDate, status: "skipped", check_count: 0, total_amount: 0,
      triggered_by: triggeredBy, error_message: "לא נמצא חשבון צ'קים",
    });
    return { ok: true, skipped: true, reason: "no-checks-account" };
  }

  if (rows.length === 0 && !settings.send_when_empty) {
    await admin.from("check_email_runs").insert({
      for_date: forDate, status: "skipped", check_count: 0, total_amount: 0, triggered_by: triggeredBy,
    });
    return { ok: true, skipped: true, reason: "no-checks-tomorrow", for_date: forDate };
  }

  const total = rows.reduce((s: number, r: any) => s + Math.abs(Number(r.amount) || 0), 0);
  const vars = {
    date: fmtIL(forDate),
    day_name: dayNameHe(forDate),
    count: String(rows.length),
    total: fmtAmount(total),
    org_name: ORG_NAME,
  };
  const subject = applyPlaceholders(settings.subject_template, vars);
  const html = renderHtml(forDate, rows, total, settings, vars);
  const raw = buildEmail(subject, html, settings.recipients, SENDER);

  if (!lovableKey || !gmailKey) {
    const msg = "חסר חיבור Gmail — לא ניתן לשלוח מיילים";
    await admin.from("check_email_runs").insert({
      for_date: forDate, status: "failed", check_count: rows.length, total_amount: total,
      triggered_by: triggeredBy, error_message: msg,
    });
    throw new Error(msg);
  }

  const resp = await fetch(
    "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!resp.ok) {
    const errorBody = await resp.text();
    const errMsg = `Gmail API ${resp.status}: ${errorBody.slice(0, 800)}`;
    await admin.from("check_email_runs").insert({
      for_date: forDate, status: "failed", check_count: rows.length, total_amount: total,
      triggered_by: triggeredBy, error_message: errMsg,
    });
    throw new Error(errMsg);
  }

  await admin.from("check_email_runs").insert({
    for_date: forDate, status: "sent", check_count: rows.length, total_amount: total, triggered_by: triggeredBy,
  });

  return { ok: true, sent: true, for_date: forDate, count: rows.length, total };
}
