// Server-only helper: export each table as CSV and upload to Google Drive.
// Uses per-table streaming to stay within the Worker memory limit.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive";
const ROOT_FOLDER_NAME = "גיבויים - מרכז קארלין סטולין";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const CSV_MIME = "text/csv";
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

async function findFolder(name: string, parentId?: string): Promise<string | null> {
  const parts = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='${FOLDER_MIME}'`,
    `trashed=false`,
  ];
  if (parentId) parts.push(`'${parentId}' in parents`);
  const q = encodeURIComponent(parts.join(" and "));
  const found = await driveJson(
    `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`,
    { headers: driveHeaders() }
  );
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

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

async function uploadCsv(folderId: string, fileName: string, content: string): Promise<{ id: string; size: number }> {
  const bytes = new TextEncoder().encode("\uFEFF" + content); // BOM for Excel
  const boundary = "----lovableBackup" + Math.random().toString(36).slice(2);
  const metadata = { name: fileName, mimeType: CSV_MIME, parents: [folderId] };
  const enc = new TextEncoder();
  const meta = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: ${CSV_MIME}\r\nContent-Transfer-Encoding: binary\r\n\r\n`
  );
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
  if (!res.ok) throw new Error(`Upload ${fileName} failed ${res.status}: ${text.slice(0, 500)}`);
  const json = JSON.parse(text);
  return { id: json.id as string, size: bytes.length };
}

async function exportTable(table: string, folderId: string): Promise<{ rows: number; size: number; fileId: string | null }> {
  const PAGE = 1000;
  let from = 0;
  let total = 0;
  let csv = "";
  let headers: string[] | null = null;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from(table as any)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Fetch ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    if (!headers) {
      headers = Object.keys(data[0]);
      csv = headers.join(",") + "\n";
    }
    for (const r of data) {
      csv += headers.map((h) => csvEscape((r as any)[h])).join(",") + "\n";
    }
    total += data.length;
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (total === 0) return { rows: 0, size: 0, fileId: null };
  const { id, size } = await uploadCsv(folderId, `${table}.csv`, csv);
  return { rows: total, size, fileId: id };
}

async function pruneOldBackups(rootFolderId: string) {
  const q = encodeURIComponent(
    `'${rootFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`
  );
  const listed = await driveJson(
    `/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&pageSize=200`,
    { headers: driveHeaders() }
  );
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const f of listed.files || []) {
    let fileTime = new Date(f.createdTime).getTime();
    const m = /backup-(\d{4}-\d{2}-\d{2})/.exec(f.name);
    if (m) fileTime = new Date(m[1]).getTime();
    if (fileTime < cutoff) {
      await fetch(`${GATEWAY_URL}/drive/v3/files/${f.id}?supportsAllDrives=true`, {
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
    const rootFolderId = await ensureFolder(ROOT_FOLDER_NAME);
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const timeStr = today.toISOString().slice(11, 16).replace(":", "");
    const dayFolderName = `backup-${dateStr}-${timeStr}`;
    const dayFolderId = await createFolder(dayFolderName, rootFolderId);

    const tables = [
      "transactions",
      "accounts",
      "funds",
      "expense_types",
      "categories",
      "subcategories",
      "action_history",
      "sync_ignores",
      "profiles",
      "user_roles",
      "import_batches",
      "backup_runs",
    ];

    const counts: Record<string, number> = {};
    let totalBytes = 0;
    for (const t of tables) {
      const res = await exportTable(t, dayFolderId);
      counts[t] = res.rows;
      totalBytes += res.size;
    }

    await pruneOldBackups(rootFolderId).catch(() => {});

    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        file_name: dayFolderName,
        file_id: dayFolderId,
        folder_id: rootFolderId,
        size_bytes: totalBytes,
        row_counts: counts,
      })
      .eq("id", runId);

    return {
      ok: true,
      fileName: dayFolderName,
      fileId: dayFolderId,
      folderId: rootFolderId,
      sizeBytes: totalBytes,
      rowCounts: counts,
    };
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
