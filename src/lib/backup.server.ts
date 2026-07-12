// Server-only helper: build one financial XLSX workbook, wipe the backup
// folder on Drive, and upload the file.
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive";
const ROOT_FOLDER_NAME = "גיבויים - מרכז קארלין סטולין";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PAGE_SIZE = 1000;

function driveHeaders(extra: Record<string, string> = {}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) throw new Error("Missing LOVABLE_API_KEY or GOOGLE_DRIVE_API_KEY");
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey, ...extra };
}

async function driveJson(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}${path}`, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const parts = [`name='${name.replace(/'/g, "\\'")}'`, `mimeType='${FOLDER_MIME}'`, `trashed=false`];
  if (parentId) parts.push(`'${parentId}' in parents`);
  const q = encodeURIComponent(parts.join(" and "));
  const found = await driveJson(`/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`, { headers: driveHeaders() });
  return found.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId?: string): Promise<string> {
  const body: any = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];
  const created = await driveJson(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: driveHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return created.id as string;
}

async function ensureFolder(name: string, parentId?: string): Promise<string> {
  return (await findFolder(name, parentId)) ?? (await createFolder(name, parentId));
}

async function wipeFolder(folderId: string, keepFileId?: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const listed = await driveJson(
    `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1000`,
    { headers: driveHeaders() }
  );
  for (const f of listed.files || []) {
    if (f.id === keepFileId) continue;
    const res = await fetch(`${GATEWAY_URL}/drive/v3/files/${f.id}?supportsAllDrives=true`, {
      method: "DELETE",
      headers: driveHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Delete old backup failed ${res.status}: ${text.slice(0, 500)}`);
    }
  }
}

async function uploadXlsx(folderId: string, fileName: string, bytes: Uint8Array) {
  const boundary = "----lovableBackup" + Math.random().toString(36).slice(2);
  const metadata = { name: fileName, mimeType: XLSX_MIME, parents: [folderId] };
  const enc = new TextEncoder();
  const meta = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
  const head = enc.encode(`--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\nContent-Transfer-Encoding: binary\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(meta.length + head.length + bytes.length + tail.length);
  body.set(meta, 0);
  body.set(head, meta.length);
  body.set(bytes, meta.length + head.length);
  body.set(tail, meta.length + head.length + bytes.length);

  const res = await fetch(`${GATEWAY_URL}/upload/drive/v3/files?uploadType=multipart&fields=id,size`, {
    method: "POST",
    headers: driveHeaders({ "Content-Type": `multipart/related; boundary=${boundary}` }),
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload failed ${res.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  return { id: json.id as string };
}

async function fetchAll(table: string, order?: { col: string; asc: boolean }): Promise<any[]> {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    let q = supabaseAdmin.from(table as any).select("*").range(from, from + PAGE_SIZE - 1);
    if (order) q = q.order(order.col, { ascending: order.asc });
    const { data, error } = await q;
    if (error) throw new Error(`fetch ${table}@${from}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

function fmtDateIL(v: any): string {
  if (!v) return "";
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function fmtNum(v: any): number | string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

type Col = { header: string; get: (r: any, m: Maps) => any };
type Maps = {
  fund: Map<string, string>;
  exp: Map<string, string>;
  cat: Map<string, string>;
  sub: Map<string, string>;
  account: Map<string, string>;
};

const COMMON: Col[] = [
  { header: "קופה", get: (r, m) => (r.fund_id ? m.fund.get(r.fund_id) ?? "" : "") },
  { header: "סוג", get: (r, m) => (r.expense_type_id ? m.exp.get(r.expense_type_id) ?? "" : "") },
  { header: "קטגוריה", get: (r, m) => (r.category_id ? m.cat.get(r.category_id) ?? "" : "") },
  { header: "תת קטגוריה", get: (r, m) => (r.subcategory_id ? m.sub.get(r.subcategory_id) ?? "" : "") },
  { header: "הערה", get: (r) => r.note ?? "" },
  { header: "לא מסווג", get: (r) => (!r.fund_id && !r.expense_type_id ? "כן" : "") },
];

const COLS_BY_SCHEMA: Record<string, Col[]> = {
  mercantile: [
    { header: "תאריך", get: (r) => fmtDateIL(r.transaction_date) },
    { header: "יום ערך", get: (r) => fmtDateIL(r.value_date) },
    { header: "תיאור התנועה", get: (r) => r.description ?? "" },
    { header: "אסמכתה", get: (r) => r.reference ?? "" },
    { header: "זכות", get: (r) => fmtNum(r.credit) },
    { header: "חובה", get: (r) => fmtNum(r.debit) },
    { header: "יתרה", get: (r) => fmtNum(r.balance) },
    { header: "עמלה", get: (r) => fmtNum(r.fee) },
    { header: "ערוץ ביצוע", get: (r) => r.channel ?? "" },
    ...COMMON,
  ],
  pagi: [
    { header: "תאריך", get: (r) => fmtDateIL(r.transaction_date) },
    { header: "תאריך ערך", get: (r) => fmtDateIL(r.value_date) },
    { header: "תאור", get: (r) => r.description ?? "" },
    { header: "אסמכתא", get: (r) => r.reference ?? "" },
    { header: "סוג פעולה", get: (r) => r.operation_type ?? "" },
    { header: "זכות", get: (r) => fmtNum(r.credit) },
    { header: "חובה", get: (r) => fmtNum(r.debit) },
    { header: "יתרה", get: (r) => fmtNum(r.balance) },
    ...COMMON,
  ],
  checks: [
    { header: "תאריך", get: (r) => fmtDateIL(r.transaction_date) },
    { header: "תאריך ערך", get: (r) => fmtDateIL(r.value_date) },
    { header: "שם", get: (r) => r.payee ?? "" },
    { header: "עמותה", get: (r) => r.association ?? "" },
    { header: "סכום", get: (r) => fmtNum(r.amount) },
    { header: "צ'ק עתידי", get: (r) => (r.future_check === true ? "כן" : "") },
    ...COMMON,
  ],
  cash: [
    { header: "תאריך", get: (r) => fmtDateIL(r.transaction_date) },
    { header: "פירוט", get: (r) => r.description ?? "" },
    { header: "סכום הכנסה", get: (r) => fmtNum(r.credit) },
    { header: "סכום הוצאה", get: (r) => fmtNum(r.debit) },
    { header: "הערה", get: (r) => r.note ?? "" },
    { header: "קופה", get: (r, m) => (r.fund_id ? m.fund.get(r.fund_id) ?? "" : "") },
    { header: "סוג", get: (r, m) => (r.expense_type_id ? m.exp.get(r.expense_type_id) ?? "" : "") },
    { header: "קטגוריה", get: (r, m) => (r.category_id ? m.cat.get(r.category_id) ?? "" : "") },
    { header: "תת קטגוריה", get: (r, m) => (r.subcategory_id ? m.sub.get(r.subcategory_id) ?? "" : "") },
  ],
};

function safeSheetName(name: string, used: Set<string>): string {
  let n = (name || "גיליון").replace(/[\\/?*\[\]:]/g, " ").slice(0, 31);
  if (!n.trim()) n = "גיליון";
  let candidate = n;
  let i = 2;
  while (used.has(candidate)) {
    const suffix = ` (${i++})`;
    candidate = n.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

function addSheet(wb: XLSX.WorkBook, name: string, used: Set<string>, header: string[], rows: any[][]) {
  const aoa = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = header.map((h) => ({ wch: Math.min(30, Math.max(10, String(h).length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name, used));
}

async function buildWorkbook(): Promise<{ bytes: Uint8Array; counts: Record<string, number> }> {
  // A financial backup contains all transactions and the lookup data needed
  // to understand them. Operational logs (especially action_history with tens
  // of thousands of JSON snapshots) are deliberately excluded: loading them
  // into SheetJS duplicates the data several times and exceeds the Worker
  // memory limit before the file can be uploaded.
  const [accounts, funds, expTypes, categories, subcats] = await Promise.all([
    fetchAll("accounts"),
    fetchAll("funds"),
    fetchAll("expense_types"),
    fetchAll("categories"),
    fetchAll("subcategories"),
  ]);

  const transactions = await fetchAll("transactions", { col: "transaction_date", asc: false });

  const maps: Maps = {
    fund: new Map(funds.map((f: any) => [f.id, f.name])),
    exp: new Map(expTypes.map((e: any) => [e.id, e.name])),
    cat: new Map(categories.map((c: any) => [c.id, c.name])),
    sub: new Map(subcats.map((s: any) => [s.id, s.name])),
    account: new Map(accounts.map((a: any) => [a.id, a.name])),
  };

  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  const counts: Record<string, number> = {};

  // Per-account transaction sheets, columns matching the on-screen layout.
  const byAccount = new Map<string, any[]>();
  for (const t of transactions) {
    const arr = byAccount.get(t.account_id) ?? [];
    arr.push(t);
    byAccount.set(t.account_id, arr);
  }
  for (const acc of accounts) {
    const cols = COLS_BY_SCHEMA[acc.schema_type as string] ?? COLS_BY_SCHEMA.mercantile;
    const rows = byAccount.get(acc.id) ?? [];
    const data = rows.map((r) => cols.map((c) => c.get(r, maps)));
    addSheet(wb, acc.name, used, cols.map((c) => c.header), data);
    counts[`תנועות · ${acc.name}`] = rows.length;
  }

  // Lookup sheets
  addSheet(wb, "חשבונות", used,
    ["שם", "סוג סכמה", "מטבע", "יתרת פתיחה", "פעיל"],
    accounts.map((a: any) => [a.name, a.schema_type, a.currency ?? "", fmtNum(a.opening_balance), a.active === false ? "לא" : "כן"]));
  counts["חשבונות"] = accounts.length;

  addSheet(wb, "קופות", used,
    ["שם"],
    funds.map((f: any) => [f.name]));
  counts["קופות"] = funds.length;

  addSheet(wb, "סוגי הוצאה", used,
    ["שם"],
    expTypes.map((e: any) => [e.name]));
  counts["סוגי הוצאה"] = expTypes.length;

  addSheet(wb, "קטגוריות", used,
    ["שם"],
    categories.map((c: any) => [c.name]));
  counts["קטגוריות"] = categories.length;

  addSheet(wb, "תת קטגוריות", used,
    ["שם", "קטגוריה"],
    subcats.map((s: any) => [s.name, maps.cat.get(s.category_id) ?? ""]));
  counts["תת קטגוריות"] = subcats.length;

  const output = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    compression: true,
    bookSST: false,
  }) as ArrayBuffer;
  const bytes = new Uint8Array(output);
  return { bytes, counts };
}

export async function runBackup(triggeredBy: "cron" | "manual", existingRunId?: string) {
  let runId = existingRunId;
  if (!runId) {
    const { data: run, error } = await supabaseAdmin
      .from("backup_runs")
      .insert({ status: "running", triggered_by: triggeredBy })
      .select("id")
      .single();
    if (error || !run) throw new Error(error?.message ?? "Could not create run");
    runId = run.id;
  }

  try {
    const rootFolderId = await ensureFolder(ROOT_FOLDER_NAME);
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10) + "-" + now.toISOString().slice(11, 16).replace(":", "");
    const fileName = `גיבוי-${stamp}.xlsx`;

    await supabaseAdmin.from("backup_runs").update({
      folder_id: rootFolderId,
      file_name: fileName,
      heartbeat_at: new Date().toISOString(),
      current_table: "building",
    }).eq("id", runId);

    const { bytes, counts } = await buildWorkbook();

    await supabaseAdmin.from("backup_runs").update({
      heartbeat_at: new Date().toISOString(),
      current_table: "cleanup",
      size_bytes: bytes.length,
    }).eq("id", runId);

    await supabaseAdmin.from("backup_runs").update({
      heartbeat_at: new Date().toISOString(),
      current_table: "uploading",
    }).eq("id", runId);

    const uploaded = await uploadXlsx(rootFolderId, fileName, bytes);

    // Keep the previous backup until the new file is safely uploaded, then
    // remove every older file while preserving the newly-created workbook.
    await supabaseAdmin.from("backup_runs").update({
      heartbeat_at: new Date().toISOString(),
      current_table: "cleanup",
      file_id: uploaded.id,
    }).eq("id", runId);
    await wipeFolder(rootFolderId, uploaded.id);

    const totalRows = Object.values(counts).reduce((s, n) => s + Number(n || 0), 0);
    await supabaseAdmin.from("backup_runs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      current_table: null,
      file_id: uploaded.id,
      size_bytes: bytes.length,
      processed_rows: totalRows,
      row_counts: counts,
    }).eq("id", runId);

    return {
      ok: true, status: "success" as const, runId,
      fileName, fileId: uploaded.id, folderId: rootFolderId,
      sizeBytes: bytes.length, rowCounts: counts,
    };
  } catch (err: any) {
    const message = (err?.message ?? String(err)).slice(0, 2000);
    await supabaseAdmin.from("backup_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      error_message: message,
    }).eq("id", runId);
    throw new Error(message);
  }
}

// Kept for API compatibility — no more chunked resume with single-file backups.
// Any stale "running" row that never finished is marked failed so the UI stops polling.
export async function resumePendingBackup() {
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabaseAdmin.from("backup_runs").update({
    status: "failed",
    finished_at: new Date().toISOString(),
    error_message: "הריצה הופסקה ללא התקדמות במשך יותר מ־15 דקות.",
  }).eq("status", "running").lt("heartbeat_at", staleCutoff);
  return { ok: true, status: "idle" as const };
}
