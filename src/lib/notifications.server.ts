import { createClient } from "@supabase/supabase-js";

/**
 * Notification generator.
 *
 * Runs on the hourly cron (and on demand from the bell). Every signal produces
 * a stable `dedupe_key`; the unique index on (user_id, dedupe_key) makes
 * re-running the generator idempotent, so the same alert never piles up.
 */

export type Severity = "info" | "warning" | "critical";

interface Signal {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  severity: Severity;
  dedupeKey: string;
  /** Only admins/superadmins receive security-related signals. */
  adminsOnly?: boolean;
}

function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function todayInIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return t.toISOString().slice(0, 10);
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function collectSignals(admin: any): Promise<Signal[]> {
  const today = todayInIsrael();
  const signals: Signal[] = [];

  const [{ data: rowsJson }, { data: accounts }] = await Promise.all([
    admin.rpc("dashboard_rows"),
    admin.from("accounts").select("id,name,kind,schema_type,is_active"),
  ]);
  const rows: any[] = (rowsJson as any[]) ?? [];
  const accList: any[] = accounts ?? [];
  const accById = new Map(accList.map((a) => [a.id, a]));

  /* --- 1. Uncategorized transactions ------------------------------------ */
  const uncat = rows.filter((r) => !r.fund_id || !r.expense_type_id).length;
  if (uncat > 0) {
    signals.push({
      kind: "uncategorized",
      title: `${uncat.toLocaleString("he-IL")} תנועות ממתינות לסיווג`,
      body: "תנועות ללא קופה או ללא סוג הוצאה. אפשר לסווג אותן בדוח \"לא מסווגות\".",
      link: "/reports?tab=uncategorized",
      severity: uncat > 500 ? "warning" : "info",
      dedupeKey: `uncategorized-${today}`,
    });
  }

  /* --- 2. Checks due tomorrow (the day before payment only) -------------- */
  const checksAcc = accList.find((a) => a.schema_type === "checks");
  if (checksAcc) {
    const tomorrow = addDays(today, 1);
    const due = rows.filter(
      (r) => r.account_id === checksAcc.id && r.value_date === tomorrow,
    );
    if (due.length) {
      const total = due.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0);
      signals.push({
        kind: "checks_due",
        title: `${due.length} צ'קים לפירעון מחר`,
        body: `סה"כ ${fmtAmount(total)}. מומלץ לוודא כיסוי בחשבון.`,
        link: "/reports?tab=future-checks",
        severity: "warning",
        dedupeKey: `checks-due-${tomorrow}`,
      });
    }
  }


  /* Balance-level signals (negative balance / low cash) are intentionally not
     raised in the bell — managers asked for task and failure alerts only. */


  /* --- 5. Recent imports ------------------------------------------------- */
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: batches } = await admin
    .from("import_batches")
    .select("id,file_name,row_count,created_at,account_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  for (const b of batches ?? []) {
    signals.push({
      kind: "import_done",
      title: `יובאו ${b.row_count} תנועות`,
      body: `הקובץ "${b.file_name}" נקלט לחשבון ${accById.get(b.account_id)?.name ?? ""}.`,
      link: "/transactions",
      severity: "info",
      dedupeKey: `import-${b.id}`,
    });
  }

  /* --- 6. Failed backup -------------------------------------------------- */
  const { data: lastBackup } = await admin
    .from("backup_runs")
    .select("id,status,error_message,started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastBackup && lastBackup.status === "failed") {
    signals.push({
      kind: "backup_failed",
      title: "הגיבוי היומי נכשל",
      body: lastBackup.error_message?.slice(0, 300) ?? "פרטים נוספים במסך הגיבוי.",
      link: "/admin-settings",
      severity: "critical",
      dedupeKey: `backup-failed-${lastBackup.id}`,
      adminsOnly: true,
    });
  }

  /* --- 7. Failed login attempts ------------------------------------------ */
  const { data: fails } = await admin
    .from("failed_login_attempts")
    .select("id")
    .gte("created_at", since);
  if ((fails?.length ?? 0) >= 5) {
    signals.push({
      kind: "failed_logins",
      title: `${fails!.length} ניסיונות התחברות כושלים ביממה האחרונה`,
      body: "מומלץ לבדוק את יומן ההתחברויות במסך האבטחה.",
      link: "/admin-settings",
      severity: "warning",
      dedupeKey: `failed-logins-${today}`,
      adminsOnly: true,
    });
  }

  return signals;
}

/**
 * Fans the current signals out to every admin/editor user. Returns how many
 * new notification rows were actually created.
 */
export async function generateNotifications(): Promise<{ created: number; signals: number }> {
  const admin = adminClient();

  const { data: roleRows } = await admin.from("user_roles").select("user_id, role");
  const recipients = new Map<string, Set<string>>();
  for (const r of roleRows ?? []) {
    if (!recipients.has(r.user_id)) recipients.set(r.user_id, new Set());
    recipients.get(r.user_id)!.add(r.role);
  }
  if (recipients.size === 0) return { created: 0, signals: 0 };

  const signals = await collectSignals(admin);
  if (!signals.length) return { created: 0, signals: 0 };

  const payload: any[] = [];
  for (const [userId, roles] of recipients) {
    const isAdmin = roles.has("admin") || roles.has("superadmin");
    const isEditor = roles.has("editor");
    if (!isAdmin && !isEditor) continue; // viewers get no alerts
    for (const s of signals) {
      if (s.adminsOnly && !isAdmin) continue;
      payload.push({
        user_id: userId,
        kind: s.kind,
        title: s.title,
        body: s.body ?? null,
        link: s.link ?? null,
        severity: s.severity,
        dedupe_key: s.dedupeKey,
      });
    }
  }
  if (!payload.length) return { created: 0, signals: signals.length };

  const { data, error } = await admin
    .from("notifications")
    .upsert(payload, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`notifications: ${error.message}`);

  return { created: data?.length ?? 0, signals: signals.length };
}
