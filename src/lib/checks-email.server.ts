import { createClient } from "@supabase/supabase-js";

const SENDER = "RM0549438753@gmail.com";
const RECIPIENTS = ["RM0549438753@gmail.com", "5326725@gmail.com"];

function tomorrowInIsrael(): string {
  // Compute tomorrow's date in Asia/Jerusalem timezone (YYYY-MM-DD).
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

function renderHtml(dateISO: string, rows: any[], total: number): string {
  const dateIL = fmtIL(dateISO);
  const tableRows = rows
    .map(
      (r, i) => `
      <tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"};">
        <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.payee || r.description || "—")}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.association || "—")}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;white-space:nowrap;">${fmtAmount(Math.abs(Number(r.amount) || 0))}</td>
        <td style="padding:10px 12px;border:1px solid #e2e8f0;">${escapeHtml(r.note || r.reference || "")}</td>
      </tr>`
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:720px;margin:0 auto;padding:24px;">
    <div style="background:#0b1e3f;color:#f5c243;padding:20px 24px;border-radius:12px 12px 0 0;">
      <div style="font-size:22px;font-weight:700;">מרכז קארלין סטולין</div>
      <div style="font-size:14px;opacity:0.9;margin-top:4px;">התראה יומית · צ'קים לפירעון</div>
    </div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
      <p style="font-size:16px;margin:0 0 12px;">שלום,</p>
      <p style="font-size:15px;margin:0 0 16px;line-height:1.6;">
        מצורפת רשימת הצ'קים שאמורים לצאת מהבנק מחר,
        <b>${dateIL}</b> · סה"כ <b>${rows.length}</b> צ'קים בסך <b>${fmtAmount(total)}</b>.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <thead>
          <tr style="background:#0b1e3f;color:#ffffff;">
            <th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">שם</th>
            <th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">עמותה</th>
            <th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">סכום</th>
            <th style="padding:10px 12px;border:1px solid #0b1e3f;text-align:right;">הערה</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr style="background:#fef3c7;">
            <td colspan="2" style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">סה"כ</td>
            <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">${fmtAmount(total)}</td>
            <td style="padding:10px 12px;border:1px solid #e2e8f0;">${rows.length} צ'קים</td>
          </tr>
        </tfoot>
      </table>
      <p style="font-size:12px;color:#64748b;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;">
        הודעה זו נשלחה אוטומטית ממערכת הניהול הפיננסי של מרכז קארלין סטולין.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function runDailyChecksEmail(triggeredBy: "cron" | "manual") {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const forDate = tomorrowInIsrael();

  // Find checks account
  const { data: acc, error: accErr } = await admin
    .from("accounts")
    .select("id")
    .eq("schema_type", "checks")
    .maybeSingle();
  if (accErr) throw new Error(`accounts: ${accErr.message}`);
  if (!acc) {
    await admin.from("check_email_runs").insert({
      for_date: forDate,
      status: "skipped",
      check_count: 0,
      total_amount: 0,
      triggered_by: triggeredBy,
      error_message: "לא נמצא חשבון צ'קים",
    });
    return { ok: true, skipped: true, reason: "no-checks-account" };
  }

  const { data: rows, error: txErr } = await admin
    .from("transactions")
    .select("payee,description,association,amount,note,reference,value_date")
    .eq("account_id", acc.id)
    .eq("value_date", forDate)
    .order("payee", { ascending: true });
  if (txErr) throw new Error(`transactions: ${txErr.message}`);

  if (!rows || rows.length === 0) {
    await admin.from("check_email_runs").insert({
      for_date: forDate,
      status: "skipped",
      check_count: 0,
      total_amount: 0,
      triggered_by: triggeredBy,
    });
    return { ok: true, skipped: true, reason: "no-checks-tomorrow", for_date: forDate };
  }

  const total = rows.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
  const html = renderHtml(forDate, rows, total);
  const subject = `צ'קים יוצאים מחר · ${fmtIL(forDate)} · סה"כ ${fmtAmount(total)}`;
  const raw = buildEmail(subject, html, RECIPIENTS, SENDER);

  if (!lovableKey || !gmailKey) {
    const msg = "חסר חיבור Gmail — לא ניתן לשלוח מיילים";
    await admin.from("check_email_runs").insert({
      for_date: forDate,
      status: "failed",
      check_count: rows.length,
      total_amount: total,
      triggered_by: triggeredBy,
      error_message: msg,
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
      for_date: forDate,
      status: "failed",
      check_count: rows.length,
      total_amount: total,
      triggered_by: triggeredBy,
      error_message: errMsg,
    });
    throw new Error(errMsg);
  }

  await admin.from("check_email_runs").insert({
    for_date: forDate,
    status: "sent",
    check_count: rows.length,
    total_amount: total,
    triggered_by: triggeredBy,
  });

  return { ok: true, sent: true, for_date: forDate, count: rows.length, total };
}
