// Server-only helper: build XLSX and upload to Google Drive.
// Must only be imported inside server function/route handlers.
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive";
const FOLDER_NAME = "גיבויים - מרכז קארלין סטולין";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const RETENTION_DAYS = 30;

function driveHeaders(extra: Record<string, string> = {}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !driveKey) {
    throw new Error("Missing LOVABLE_API_KEY or GOOGLE_DRIVE_API_KEY");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
    ...extra,
  };
}

async function driveJson(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}${path}`, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Drive API ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function ensureFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME.replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const found = await driveJson(
    `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`,
    { headers: driveHeaders() }
  );
  if (found.files && found.files.length > 0) return found.files[0].id as string;

  const created = await driveJson(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: driveHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  return created.id as string;
}

async function fetchAllRows(table: string): Promise<any[]> {
  const PAGE = 1000;
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table as any)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function sheetFromRows(rows: any[]) {
  if (rows.length === 0) return XLSX.utils.aoa_to_sheet([["(אין נתונים)"]]);
  return XLSX.utils.json_to_sheet(rows);
}

async function buildWorkbook(): Promise<{ buffer: Uint8Array; counts: Record<string, number> }> {
  const tables = [
    { name: "transactions", label: "תנועות" },
    { name: "accounts", label: "חשבונות" },
    { name: "funds", label: "קופות" },
    { name: "expense_types", label: "סוגים" },
    { name: "categories", label: "קטגוריות" },
    { name: "subcategories", label: "תת-קטגוריות" },
    { name: "action_history", label: "היסטוריית פעילות" },
    { name: "sync_ignores", label: "sync_ignores" },
    { name: "profiles", label: "פרופילים" },
    { name: "user_roles", label: "הרשאות" },
    { name: "import_batches", label: "אצוות יבוא" },
  ];

  const wb = XLSX.utils.book_new();
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const rows = await fetchAllRows(t.name);
    counts[t.name] = rows.length;
    XLSX.utils.book_append_sheet(wb, sheetFromRows(rows), t.label.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { buffer: new Uint8Array(buf), counts };
}

async function uploadFile(folderId: string, fileName: string, data: Uint8Array): Promise<string> {
  const boundary = "----lovableBackup" + Math.random().toString(36).slice(2);
  const metadata = { name: fileName, mimeType: XLSX_MIME, parents: [folderId] };
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n`;
  const filePartHeader =
    `--${boundary}\r\n` +
    `Content-Type: ${XLSX_MIME}\r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const enc = new TextEncoder();
  const metaBytes = enc.encode(metaPart);
  const fileHeadBytes = enc.encode(filePartHeader);
  const closingBytes = enc.encode(closing);
  const body = new Uint8Array(metaBytes.length + fileHeadBytes.length + data.length + closingBytes.length);
  body.set(metaBytes, 0);
  body.set(fileHeadBytes, metaBytes.length);
  body.set(data, metaBytes.length + fileHeadBytes.length);
  body.set(closingBytes, metaBytes.length + fileHeadBytes.length + data.length);

  const res = await fetch(`${GATEWAY_URL}/upload/drive/v3/files?uploadType=multipart&fields=id,name,size`, {
    method: "POST",
    headers: driveHeaders({ "Content-Type": `multipart/related; boundary=${boundary}` }),
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload failed ${res.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  return json.id as string;
}

async function pruneOldBackups(folderId: string) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType='${XLSX_MIME}' and trashed=false`
  );
  const listed = await driveJson(
    `/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&pageSize=200`,
    { headers: driveHeaders() }
  );
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const f of listed.files || []) {
    // parse date from file name backup-YYYY-MM-DD.xlsx if present, else use createdTime
    let fileTime = new Date(f.createdTime).getTime();
    const m = /backup-(\d{4}-\d{2}-\d{2})/.exec(f.name);
    if (m) fileTime = new Date(m[1]).getTime();
    if (fileTime < cutoff) {
      await fetch(`${GATEWAY_URL}/drive/v3/files/${f.id}`, {
        method: "DELETE",
        headers: driveHeaders(),
      }).catch(() => {});
    }
  }
}

export async function runBackup(triggeredBy: "cron" | "manual") {
  const { data: run, error: runErr } = await supabaseAdmin
    .from("backup_runs")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(runErr?.message ?? "Could not create run");
  const runId = run.id;

  try {
    const folderId = await ensureFolder();
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const fileName = `backup-${dateStr}.xlsx`;

    const { buffer, counts } = await buildWorkbook();
    const fileId = await uploadFile(folderId, fileName, buffer);
    await pruneOldBackups(folderId).catch(() => {});

    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        file_name: fileName,
        file_id: fileId,
        folder_id: folderId,
        size_bytes: buffer.length,
        row_counts: counts,
      })
      .eq("id", runId);

    return { ok: true, fileName, fileId, folderId, sizeBytes: buffer.length, rowCounts: counts };
  } catch (err: any) {
    const message = err?.message ?? String(err);
    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message.slice(0, 2000),
      })
      .eq("id", runId);
    throw err;
  }
}
