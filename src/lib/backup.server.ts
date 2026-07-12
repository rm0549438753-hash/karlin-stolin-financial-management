// Server-only helper: export each table as CSV chunks and upload to Google Drive.
// Streams each chunk (page) directly to Drive to stay well under Worker memory limits.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive";
const ROOT_FOLDER_NAME = "גיבויים - מרכז קארלין סטולין";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const CSV_MIME = "text/csv";
const RETENTION_DAYS = 30;
const PAGE_SIZE = 1000;
const TABLES = [
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
] as const;

type BackupProgress = {
  tableIndex: number;
  offset: number;
  partIndex: number;
  headers: string[] | null;
  counts: Record<string, number>;
  totalBytes: number;
};

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

function blankProgress(): BackupProgress {
  return { tableIndex: 0, offset: 0, partIndex: 0, headers: null, counts: {}, totalBytes: 0 };
}

function readProgress(value: unknown): BackupProgress {
  if (!value || typeof value !== "object" || !("tableIndex" in value)) return blankProgress();
  const p = value as Partial<BackupProgress>;
  return {
    tableIndex: Number(p.tableIndex) || 0,
    offset: Number(p.offset) || 0,
    partIndex: Number(p.partIndex) || 0,
    headers: Array.isArray(p.headers) ? p.headers.map(String) : null,
    counts: p.counts && typeof p.counts === "object" ? p.counts : {},
    totalBytes: Number(p.totalBytes) || 0,
  };
}

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
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

export async function runBackup(
  triggeredBy: "cron" | "manual",
  existingRunId?: string
) {
  let runId = existingRunId;
  if (!runId) {
    const { data: run, error: runErr } = await supabaseAdmin
      .from("backup_runs")
      .insert({ status: "running", triggered_by: triggeredBy })
      .select("id")
      .single();
    if (runErr || !run) throw new Error(runErr?.message ?? "Could not create run");
    runId = run.id;
  }

  let currentTable = "(init)";
  try {
    return await processBackupBatch(runId);
  } catch (err: any) {
    const raw = err?.message ?? String(err);
    const message = `[${currentTable}] ${raw}`.slice(0, 2000);
    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", runId);
    throw new Error(message);
  }
}

async function processBackupBatch(runId: string) {
  const { data: run, error: runError } = await supabaseAdmin
    .from("backup_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (runError || !run) throw new Error(runError?.message ?? "Backup run not found");
  if (run.status === "success" || run.status === "failed") {
    return { ok: run.status === "success", status: run.status, runId };
  }

  let rootFolderId = run.folder_id as string | null;
  let dayFolderId = run.file_id as string | null;
  let dayFolderName = run.file_name as string | null;
  if (!rootFolderId || !dayFolderId || !dayFolderName) {
    rootFolderId = await ensureFolder(ROOT_FOLDER_NAME);
    const now = new Date();
    dayFolderName = `backup-${now.toISOString().slice(0, 10)}-${now.toISOString().slice(11, 16).replace(":", "")}`;
    dayFolderId = await createFolder(dayFolderName, rootFolderId);
    await supabaseAdmin.from("backup_runs").update({
      file_name: dayFolderName,
      file_id: dayFolderId,
      folder_id: rootFolderId,
      heartbeat_at: new Date().toISOString(),
    }).eq("id", runId);
  }

  const progress = readProgress(run.row_counts);

  const table = TABLES[progress.tableIndex];
  const { data, error } = await supabaseAdmin
    .from(table as any)
    .select("*")
    .range(progress.offset, progress.offset + PAGE_SIZE - 1);
  if (error) throw new Error(`Fetch ${table} @${progress.offset}: ${error.message}`);

  if (!data || data.length === 0) {
    progress.counts[table] = progress.offset;
    progress.tableIndex += 1;
    progress.offset = 0;
    progress.partIndex = 0;
    progress.headers = null;
  } else {
    const headers = progress.headers ?? Object.keys(data[0]);
    let csv = headers.join(",") + "\n";
    for (const row of data) csv += headers.map((h) => csvEscape((row as any)[h])).join(",") + "\n";
    const partIndex = progress.partIndex + 1;
    const fileName = data.length < PAGE_SIZE && partIndex === 1
      ? `${table}.csv`
      : `${table}-part-${String(partIndex).padStart(3, "0")}.csv`;
    const uploaded = await uploadCsv(dayFolderId, fileName, csv);
    progress.totalBytes += uploaded.size;
    progress.offset += data.length;
    progress.partIndex = partIndex;
    progress.headers = headers;
    progress.counts[table] = progress.offset;
    if (data.length < PAGE_SIZE) {
      progress.tableIndex += 1;
      progress.offset = 0;
      progress.partIndex = 0;
      progress.headers = null;
    }
  }

  await supabaseAdmin.from("backup_runs").update({
    row_counts: progress,
    size_bytes: progress.totalBytes,
    current_table: progress.tableIndex < TABLES.length ? TABLES[progress.tableIndex] : null,
    processed_rows: Object.values(progress.counts).reduce((sum, value) => sum + Number(value || 0), 0),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", runId);

  if (progress.tableIndex >= TABLES.length) {
    await pruneOldBackups(rootFolderId).catch(() => {});
    await supabaseAdmin.from("backup_runs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      current_table: null,
      size_bytes: progress.totalBytes,
      row_counts: progress.counts,
    }).eq("id", runId);
    return { ok: true, status: "success" as const, runId, fileName: dayFolderName, fileId: dayFolderId, folderId: rootFolderId, sizeBytes: progress.totalBytes, rowCounts: progress.counts };
  }
  return { ok: true, status: "running" as const, runId, fileName: dayFolderName, fileId: dayFolderId, folderId: rootFolderId, sizeBytes: progress.totalBytes, rowCounts: progress.counts };
}

export async function resumePendingBackup() {
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabaseAdmin.from("backup_runs").update({
    status: "failed",
    finished_at: new Date().toISOString(),
    error_message: "הריצה הופסקה ללא התקדמות במשך יותר מ־15 דקות.",
  }).eq("status", "running").lt("heartbeat_at", staleCutoff);

  const { data: run, error } = await supabaseAdmin
    .from("backup_runs")
    .select("id")
    .eq("status", "running")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!run) return { ok: true, status: "idle" as const };

  try {
    return await processBackupBatch(run.id);
  } catch (err: any) {
    const message = (err?.message ?? String(err)).slice(0, 2000);
    await supabaseAdmin.from("backup_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      error_message: message,
    }).eq("id", run.id);
    return { ok: false, status: "failed" as const, runId: run.id, error: message };
  }
}
