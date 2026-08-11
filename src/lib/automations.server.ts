import { createClient } from "@supabase/supabase-js";

/**
 * Email automations engine.
 *
 * Each row in `email_automations` describes *when* to send (frequency +
 * send_hour) and *what* to look at (trigger_type + threshold/days_ahead).
 * The hourly cron calls runEmailAutomations("cron"); the admin panel can
 * force a single automation with runEmailAutomations("manual", { id, force }).
 */

const SENDER = "RM0549438753@gmail.com";
const ORG_NAME = "מרכז קארלין סטולין";
const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export type TriggerType =
  | "checks_due"
  | "period_summary"
  | "negative_balance"
  | "low_cash"
  | "uncategorized";

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  checks_due: "צ'קים לפירעון בימים הקרובים",
  period_summary: "סיכום תקופתי (הכנסות מול הוצאות)",
  negative_balance: "התראה על יתרה שלילית בחשבון",
  low_cash: "יתרת מזומן מתחת לסף",
  uncategorized: "הצטברות תנועות לא מסווגות",
};

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function israelParts() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { date, hour: Number(get("hour")), dow, dayOfMonth: d };
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
}

function fmtIL(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function dayNameHe(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `יום ${HEBREW_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
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

function buildRawEmail(subject: string, html: string, toList: string[]): string {
  const boundary = "----=_Part_" + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${SENDER}`,
    `To: ${toList.join(", ")}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
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

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const TH = "padding:10px 12px;border:1px solid #0b1e3f;text-align:right;direction:rtl;";
const TD = "padding:10px 12px;border:1px solid #e2e8f0;text-align:right;direction:rtl;";

function renderTable(columns: string[], rows: string[][]): string {
  if (!rows.length) return "";
  return `<table dir="rtl" align="right" style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;direction:rtl;text-align:right;">
    <thead><tr style="background:#0b1e3f;color:#ffffff;">${columns.map((c) => `<th dir="rtl" style="${TH}">${escapeHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map(
        (r, i) =>
          `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"};">${r
            .map((c) => `<td dir="rtl" style="${TD}">${c}</td>`)
            .join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

/**
 * Rich text for the intro/outro fields. Everything is escaped first, then a
 * small, safe markup subset is re-enabled: [טקסט](https://…) links, **bold**,
 * and bare URLs.
 */
function richText(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label, url) =>
      `<a href="${url}" style="color:#0b1e3f;font-weight:600;text-decoration:underline;">${label}</a>`,
  );
  out = out.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, (_m, pre, url) =>
    `${pre}<a href="${url}" style="color:#0b1e3f;text-decoration:underline;">${url}</a>`,
  );
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  return out.replace(/\n/g, "<br>");
}

function renderButton(text?: string | null, url?: string | null): string {
  if (!text || !url || !/^https?:\/\//.test(url)) return "";
  return `<div dir="rtl" style="text-align:right;margin:20px 0 4px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#0b1e3f;color:#f5c243;padding:12px 26px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(text)}</a>
  </div>`;
}

function renderShell(
  subtitle: string,
  intro: string,
  content: string,
  outro: string,
  button = "",
): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body dir="rtl" style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;direction:rtl;text-align:right;">
  <div dir="rtl" style="max-width:720px;margin:0 auto;padding:24px;direction:rtl;text-align:right;">
    <div dir="rtl" style="background:#0b1e3f;color:#f5c243;padding:20px 24px;border-radius:12px 12px 0 0;text-align:right;">
      <div style="font-size:22px;font-weight:700;">${escapeHtml(ORG_NAME)}</div>
      <div style="font-size:14px;opacity:0.9;margin-top:4px;">${escapeHtml(subtitle)}</div>
    </div>
    <div dir="rtl" style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;text-align:right;">
      <p dir="rtl" style="font-size:15px;margin:0 0 12px;line-height:1.6;">${richText(intro)}</p>
      ${content}
      <p dir="rtl" style="font-size:15px;margin:16px 0 0;line-height:1.6;">${richText(outro)}</p>
      ${button}
      <p dir="rtl" style="font-size:12px;color:#64748b;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;">
        הודעה זו נשלחה אוטומטית ממערכת הניהול הפיננסי של ${escapeHtml(ORG_NAME)}.
      </p>
    </div>
  </div>
</body>
</html>`;
}


/* ------------------------------------------------------------------ */
/* Trigger evaluation                                                  */
/* ------------------------------------------------------------------ */

interface Evaluated {
  count: number;
  content: string;
  vars: Record<string, string>;
  summary: string;
}

async function evaluate(db: any, a: any): Promise<Evaluated> {
  const { date: today } = israelParts();
  const [{ data: rowsJson }, { data: accounts }] = await Promise.all([
    db.rpc("dashboard_rows"),
    db.from("accounts").select("id,name,kind,schema_type,is_active"),
  ]);
  const rows: any[] = (rowsJson as any[]) ?? [];
  const accList: any[] = accounts ?? [];
  const accById = new Map(accList.map((x) => [x.id, x]));

  const baseVars: Record<string, string> = {
    date: fmtIL(today),
    day_name: dayNameHe(today),
    org_name: ORG_NAME,
    count: "0",
    total: fmtAmount(0),
  };

  switch (a.trigger_type as TriggerType) {
    case "checks_due": {
      const days = Math.max(0, a.days_ahead ?? 1);
      const until = addDays(today, days);
      const checksAcc = accList.find((x) => x.schema_type === "checks");
      const due = checksAcc
        ? rows.filter(
            (r) => r.account_id === checksAcc.id && r.value_date >= today && r.value_date <= until,
          )
        : [];
      due.sort((x, y) => String(x.value_date).localeCompare(String(y.value_date)));
      const total = due.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
      return {
        count: due.length,
        content: renderTable(
          ["תאריך פירעון", "שם", "עמותה", "סכום"],
          due.map((r) => [
            fmtIL(r.value_date),
            escapeHtml(r.payee || r.description || "—"),
            escapeHtml(r.association || "—"),
            fmtAmount(Math.abs(Number(r.amount) || 0)),
          ]),
        ),
        vars: { ...baseVars, count: String(due.length), total: fmtAmount(total), days: String(days) },
        summary: `${due.length} צ'קים · ${fmtAmount(total)}`,
      };
    }

    case "period_summary": {
      const spanDays = a.frequency === "monthly" ? 30 : a.frequency === "weekly" ? 7 : 1;
      const from = addDays(today, -spanDays);
      const inRange = rows.filter((r) => r.transaction_date && r.transaction_date >= from && r.transaction_date <= today);
      const income = inRange.filter((r) => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
      const expense = inRange.filter((r) => Number(r.amount) < 0).reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
      return {
        count: inRange.length,
        content: renderTable(
          ["מדד", "ערך"],
          [
            ["תקופה", `${fmtIL(from)} – ${fmtIL(today)}`],
            ["הכנסות", fmtAmount(income)],
            ["הוצאות", fmtAmount(expense)],
            ["מאזן", fmtAmount(income - expense)],
            ["מספר תנועות", String(inRange.length)],
          ],
        ),
        vars: {
          ...baseVars,
          count: String(inRange.length),
          total: fmtAmount(income - expense),
          income: fmtAmount(income),
          expense: fmtAmount(expense),
        },
        summary: `הכנסות ${fmtAmount(income)} · הוצאות ${fmtAmount(expense)}`,
      };
    }

    case "negative_balance": {
      const limit = Number(a.threshold_value ?? 0);
      const balances = new Map<string, number>();
      for (const r of rows) balances.set(r.account_id, (balances.get(r.account_id) ?? 0) + (Number(r.amount) || 0));
      const bad = [...balances.entries()].filter(([id, bal]) => {
        const acc = accById.get(id);
        return acc && acc.is_active !== false && acc.schema_type !== "checks" && bal < limit;
      });
      return {
        count: bad.length,
        content: renderTable(
          ["חשבון", "יתרה"],
          bad.map(([id, bal]) => [escapeHtml(accById.get(id)?.name ?? id), fmtAmount(bal)]),
        ),
        vars: { ...baseVars, count: String(bad.length) },
        summary: `${bad.length} חשבונות מתחת ל-${fmtAmount(limit)}`,
      };
    }

    case "low_cash": {
      const limit = Number(a.threshold_value ?? 0);
      const cashAcc = accList.find((x) => x.kind === "cash" || x.schema_type === "cash");
      const cash = cashAcc
        ? rows.filter((r) => r.account_id === cashAcc.id).reduce((s, r) => s + (Number(r.amount) || 0), 0)
        : 0;
      const triggered = cashAcc ? cash < limit : false;
      return {
        count: triggered ? 1 : 0,
        content: renderTable(
          ["מדד", "ערך"],
          [
            ["יתרת מזומן", fmtAmount(cash)],
            ["סף התראה", fmtAmount(limit)],
          ],
        ),
        vars: { ...baseVars, count: triggered ? "1" : "0", total: fmtAmount(cash) },
        summary: `יתרת מזומן ${fmtAmount(cash)}`,
      };
    }

    case "uncategorized":
    default: {
      const minCount = Number(a.threshold_value ?? 1);
      // Same definition as the "תנועות לא מסווגות" report: both fund AND
      // expense type are missing (not either/or).
      const uncat = rows.filter((r) => !r.fund_id && !r.expense_type_id);
      const byAccount = new Map<string, number>();
      for (const r of uncat) byAccount.set(r.account_id, (byAccount.get(r.account_id) ?? 0) + 1);
      const triggered = uncat.length >= minCount;
      return {
        count: triggered ? uncat.length : 0,
        content: renderTable(
          ["חשבון", "תנועות לא מסווגות"],
          [...byAccount.entries()]
            .sort((x, y) => y[1] - x[1])
            .map(([id, c]) => [escapeHtml(accById.get(id)?.name ?? id), String(c)]),
        ),
        vars: { ...baseVars, count: String(uncat.length) },
        summary: `${uncat.length} תנועות לא מסווגות`,
      };
    }
  }
}

function isDue(a: any, now: ReturnType<typeof israelParts>): boolean {
  if (a.send_hour !== now.hour) return false;
  if (a.frequency === "weekly" && now.dow !== 0) return false;
  if (a.frequency === "monthly" && now.dayOfMonth !== 1) return false;
  if (a.last_run_at) {
    const last = new Date(a.last_run_at).getTime();
    if (Date.now() - last < 6 * 3600 * 1000) return false; // guard against double runs
  }
  return true;
}

export async function previewAutomation(automationId: string) {
  const db = admin();
  const { data: a, error } = await db.from("email_automations").select("*").eq("id", automationId).maybeSingle();
  if (error || !a) throw new Error("האוטומציה לא נמצאה");
  const ev = await evaluate(db, a);
  const subject = applyPlaceholders(a.subject_template || a.name, ev.vars);
  const html = renderShell(
    TRIGGER_LABELS[a.trigger_type as TriggerType] ?? a.name,
    applyPlaceholders(a.body_intro, ev.vars),
    ev.content,
    applyPlaceholders(a.body_outro, ev.vars),
    renderButton(applyPlaceholders(a.button_text ?? "", ev.vars), a.button_url),
  );
  return { subject, html, recipients: a.recipients ?? [], count: ev.count, summary: ev.summary };
}

async function sendOne(db: any, a: any, triggeredBy: string) {
  const ev = await evaluate(db, a);

  if (ev.count === 0 && !a.send_when_empty) {
    await db.from("email_automation_runs").insert({
      automation_id: a.id,
      status: "skipped",
      recipients: a.recipients ?? [],
      summary: "אין נתונים לשליחה",
      triggered_by: triggeredBy,
    });
    await db.from("email_automations").update({ last_run_at: new Date().toISOString() }).eq("id", a.id);
    return { id: a.id, status: "skipped" as const };
  }

  const recipients: string[] = (a.recipients ?? []).filter(Boolean);
  if (!recipients.length) {
    await db.from("email_automation_runs").insert({
      automation_id: a.id,
      status: "failed",
      recipients: [],
      error_message: "לא הוגדרו נמענים",
      triggered_by: triggeredBy,
    });
    return { id: a.id, status: "failed" as const };
  }

  const subject = applyPlaceholders(a.subject_template || a.name, ev.vars);
  const html = renderShell(
    TRIGGER_LABELS[a.trigger_type as TriggerType] ?? a.name,
    applyPlaceholders(a.body_intro, ev.vars),
    ev.content,
    applyPlaceholders(a.body_outro, ev.vars),
  );

  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmailKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableKey || !gmailKey) {
    const msg = "חסר חיבור Gmail — לא ניתן לשלוח מיילים";
    await db.from("email_automation_runs").insert({
      automation_id: a.id, status: "failed", recipients, error_message: msg, triggered_by: triggeredBy,
    });
    return { id: a.id, status: "failed" as const, error: msg };
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
      body: JSON.stringify({ raw: buildRawEmail(subject, html, recipients) }),
    },
  );

  if (!resp.ok) {
    const errMsg = `Gmail API ${resp.status}: ${(await resp.text()).slice(0, 600)}`;
    await db.from("email_automation_runs").insert({
      automation_id: a.id, status: "failed", recipients, error_message: errMsg, triggered_by: triggeredBy,
    });
    return { id: a.id, status: "failed" as const, error: errMsg };
  }

  await db.from("email_automation_runs").insert({
    automation_id: a.id, status: "sent", recipients, summary: ev.summary, triggered_by: triggeredBy,
  });
  await db.from("email_automations").update({ last_run_at: new Date().toISOString() }).eq("id", a.id);
  return { id: a.id, status: "sent" as const, summary: ev.summary };
}

export async function runEmailAutomations(
  triggeredBy: "cron" | "manual",
  opts: { automationId?: string; force?: boolean } = {},
) {
  const db = admin();
  const now = israelParts();

  let query = db.from("email_automations").select("*");
  if (opts.automationId) query = query.eq("id", opts.automationId);
  else query = query.eq("is_active", true);

  const { data: list, error } = await query;
  if (error) throw new Error(`email_automations: ${error.message}`);

  const results: any[] = [];
  for (const a of list ?? []) {
    if (!opts.force && !isDue(a, now)) continue;
    try {
      results.push(await sendOne(db, a, triggeredBy));
    } catch (e: any) {
      await db.from("email_automation_runs").insert({
        automation_id: a.id,
        status: "failed",
        recipients: a.recipients ?? [],
        error_message: String(e?.message ?? e).slice(0, 600),
        triggered_by: triggeredBy,
      });
      results.push({ id: a.id, status: "failed", error: String(e?.message ?? e) });
    }
  }
  return { ok: true, ran: results.length, results };
}
