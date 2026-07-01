import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Header → transactions column mapping (mirrors ImportDialog)
const HEADER_MAP: Record<string, string> = {
  "תאריך": "transaction_date",
  "יום ערך": "value_date",
  "תאריך ערך": "value_date",
  "תיאור": "description",
  "תיאור התנועה": "description",
  "תאור": "description",
  "פירוט": "description",
  "אסמכתה": "reference",
  "אסמכתא": "reference",
  "זכות": "credit",
  "חובה": "debit",
  "סכום הכנסה": "credit",
  "סכום הוצאה": "debit",
  "₪ זכות/חובה": "amount",
  "סכום": "amount",
  "₪ יתרה": "balance",
  "יתרה": "balance",
  "עמלה": "fee",
  "ערוץ ביצוע": "channel",
  "סוג פעולה": "operation_type",
  "עמותה": "association",
  "שם": "payee",
  "הערה": "note",
  "צ'ק עתידי ?": "future_check",
  "צ'ק עתידי": "future_check",
  "קופה": "_fund_name",
  "סוג": "_expense_type_name",
  "קטגוריה": "_category_name",
  "תת קטגוריה": "_subcategory_name",
  "תת-קטגוריה": "_subcategory_name",
};

const DATE_FIELDS = new Set(["transaction_date", "value_date"]);
const NUM_FIELDS = new Set(["credit", "debit", "amount", "balance", "fee"]);
const NAME_FIELDS = new Set(["_fund_name", "_expense_type_name", "_category_name", "_subcategory_name"]);

function normHeader(v: any): string {
  return String(v ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
const HEADER_FIELD_MAP = new Map(
  Object.entries(HEADER_MAP).map(([h, f]) => [normHeader(h), f]),
);
function getMappedField(h: any): string | undefined {
  return HEADER_FIELD_MAP.get(normHeader(h));
}
function normName(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s === "" ? null : s;
}
function normAccountName(s: string): string {
  return s
    .replace(/[\u2019\u2018'׳״"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function serialToDateStr(n: number): string | null {
  // Google Sheets serial: days since 1899-12-30
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function toDateStr(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return serialToDateStr(v);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y.length === 2 ? "20" + y : y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,₪\s]/g, ""));
  return isNaN(n) ? null : n;
}
function toStr(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// Composite dedup key for a transaction row
function rowKey(r: any): string {
  const parts = [
    r.transaction_date ?? "",
    r.value_date ?? "",
    (r.description ?? "").toString().trim().replace(/\s+/g, " "),
    (r.reference ?? "").toString().trim(),
    r.credit == null ? "" : Number(r.credit).toFixed(2),
    r.debit == null ? "" : Number(r.debit).toFixed(2),
    r.amount == null ? "" : Number(r.amount).toFixed(2),
  ];
  return parts.join("|");
}

async function gatewayFetch(path: string, params?: Record<string, string | string[]>): Promise<any> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!apiKey || !connKey) throw new Error("Google Sheets connector not configured");
  const url = new URL(`https://connector-gateway.lovable.dev${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
      else url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Connection-Api-Key": connKey,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sheets gateway ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

type SheetRow = Record<string, any>;
type ParsedSheet = {
  sheetTitle: string;
  accountId: string;
  accountName: string;
  rows: SheetRow[]; // normalized rows with keys matching transactions columns + _name fields
};

async function parseAllSheets(
  spreadsheetId: string,
  accounts: { id: string; name: string; schema_type: string }[],
): Promise<{ sheets: ParsedSheet[]; skipped: string[] }> {
  const meta = await gatewayFetch(`/google_sheets/v4/spreadsheets/${spreadsheetId}`, {
    fields: "sheets.properties(title,gridProperties)",
  });
  const titles: { title: string; rowCount: number }[] = (meta.sheets ?? []).map((s: any) => ({
    title: s.properties.title,
    rowCount: s.properties.gridProperties?.rowCount ?? 1000,
  }));

  const accountByNorm = new Map(accounts.map((a) => [normAccountName(a.name), a]));
  const targeted = titles
    .map((t) => ({ ...t, account: accountByNorm.get(normAccountName(t.title)) }))
    .filter((t) => t.account) as (typeof titles[number] & {
    account: { id: string; name: string; schema_type: string };
  })[];
  const skipped = titles.filter((t) => !accountByNorm.get(normAccountName(t.title))).map((t) => t.title);

  const ranges = targeted.map((t) => `'${t.title.replace(/'/g, "''")}'!A1:Z${t.rowCount}`);
  const batch = await gatewayFetch(
    `/google_sheets/v4/spreadsheets/${spreadsheetId}/values:batchGet`,
    {
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "SERIAL_NUMBER",
    },
  );
  const valueRanges: any[] = batch.valueRanges ?? [];

  const out: ParsedSheet[] = [];
  targeted.forEach((t, idx) => {
    const aoa: any[][] = valueRanges[idx]?.values ?? [];
    if (aoa.length === 0) return;
    // detect header row (best of first 25)
    let hIdx = 0, best = 0;
    const scanLimit = Math.min(25, aoa.length);
    for (let i = 0; i < scanLimit; i++) {
      const row = aoa[i] ?? [];
      const score = row.reduce((acc: number, c: any) => acc + (getMappedField(c) ? 1 : 0), 0);
      if (score > best) { best = score; hIdx = i; }
    }
    if (best === 0) return;
    const headers = (aoa[hIdx] ?? []).map((h) => normHeader(h));
    const txnDateIdx = headers.findIndex((h) => getMappedField(h) === "transaction_date");
    const valDateIdx = headers.findIndex((h) => getMappedField(h) === "value_date");
    const amountIdxs = headers
      .map((h, i) => ({ f: getMappedField(h), i }))
      .filter((x) => x.f === "credit" || x.f === "debit" || x.f === "amount")
      .map((x) => x.i);

    const rows: SheetRow[] = [];
    for (let i = hIdx + 1; i < aoa.length; i++) {
      const r = aoa[i] ?? [];
      if (!r.some((c) => c != null && String(c).trim() !== "")) continue;
      const hasTxnDate = txnDateIdx >= 0 && toDateStr(r[txnDateIdx]) != null;
      const hasValDate = valDateIdx >= 0 && toDateStr(r[valDateIdx]) != null;
      const hasAmount = amountIdxs.some((j) => { const n = toNum(r[j]); return n != null && n !== 0; });
      if (txnDateIdx >= 0 || valDateIdx >= 0) {
        if (!hasTxnDate && !hasValDate && !hasAmount) continue;
      }
      const obj: SheetRow = {};
      headers.forEach((h, j) => {
        const field = getMappedField(h);
        if (!field) return;
        const v = r[j];
        if (DATE_FIELDS.has(field)) obj[field] = toDateStr(v);
        else if (NUM_FIELDS.has(field)) obj[field] = toNum(v);
        else if (NAME_FIELDS.has(field)) obj[field] = normName(v);
        else if (field === "future_check") obj[field] = v === true || String(v ?? "").trim() === "✓" || String(v ?? "").trim() === "כן";
        else obj[field] = toStr(v);
      });
      // derive amount if missing
      if (obj.amount == null) {
        const c = Number(obj.credit) || 0;
        const d = Number(obj.debit) || 0;
        if (c || d) obj.amount = c - d;
      }
      // For checks: credits are actually expenses (mirror import script)
      if (t.account.schema_type === "checks" && obj.credit != null && obj.debit == null) {
        obj.debit = obj.credit;
        obj.credit = null;
        if (obj.amount != null) obj.amount = -Math.abs(obj.amount);
      }
      rows.push(obj);
    }
    out.push({ sheetTitle: t.title, accountId: t.account.id, accountName: t.account.name, rows });
  });
  return { sheets: out, skipped };
}

async function ensureAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: isEditor } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "editor" });
  if (!isAdmin && !isEditor) throw new Error("Forbidden");
}

export const syncFromGoogleSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spreadsheetId: string; apply: boolean }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const supabase = context.supabase;

    const { data: accounts, error: aerr } = await supabase
      .from("accounts")
      .select("id,name,schema_type")
      .eq("is_active", true);
    if (aerr) throw aerr;

    const { sheets, skipped } = await parseAllSheets(data.spreadsheetId, accounts as any);

    // Load lookups upfront
    const [fundsRes, etRes, catRes, subRes] = await Promise.all([
      supabase.from("funds").select("id,name"),
      supabase.from("expense_types").select("id,name"),
      supabase.from("categories").select("id,name"),
      supabase.from("subcategories").select("id,name,category_id"),
    ]);
    const fundMap = new Map<string, string>();
    (fundsRes.data ?? []).forEach((r: any) => fundMap.set(normName(r.name) ?? "", r.id));
    const etMap = new Map<string, string>();
    (etRes.data ?? []).forEach((r: any) => etMap.set(normName(r.name) ?? "", r.id));
    const catMap = new Map<string, string>();
    const catNameById = new Map<string, string>();
    (catRes.data ?? []).forEach((r: any) => {
      catMap.set(normName(r.name) ?? "", r.id);
      catNameById.set(r.id, normName(r.name) ?? "");
    });
    const subMap = new Map<string, string>();
    (subRes.data ?? []).forEach((r: any) => {
      const n = normName(r.name) ?? "";
      const cn = catNameById.get(r.category_id) ?? "";
      subMap.set(`${cn}||${n}`, r.id);
      subMap.set(`||${n}`, r.id);
    });

    async function ensureLookup(
      table: "funds" | "expense_types" | "categories",
      name: string,
      map: Map<string, string>,
    ): Promise<string | null> {
      if (!name) return null;
      const hit = map.get(name);
      if (hit) return hit;
      if (!data.apply) return null; // skip creating during preview
      const { data: created, error } = await supabase.from(table).insert({ name }).select("id,name").single();
      if (error) throw error;
      map.set(normName(created.name) ?? "", created.id);
      if (table === "categories") catNameById.set(created.id, normName(created.name) ?? "");
      return created.id;
    }
    async function ensureSubcat(catName: string | null, subName: string): Promise<string | null> {
      if (!subName) return null;
      const key = `${catName ?? ""}||${subName}`;
      const hit = subMap.get(key) ?? subMap.get(`||${subName}`);
      if (hit) return hit;
      if (!data.apply) return null;
      const catId = catName ? catMap.get(catName) : null;
      if (!catId) return null;
      const { data: created, error } = await supabase
        .from("subcategories")
        .insert({ name: subName, category_id: catId })
        .select("id,name,category_id")
        .single();
      if (error) throw error;
      const cn = catNameById.get(created.category_id) ?? "";
      const nn = normName(created.name) ?? "";
      subMap.set(`${cn}||${nn}`, created.id);
      subMap.set(`||${nn}`, created.id);
      return created.id;
    }

    // Per-account diff
    const perAccount: { accountId: string; accountName: string; sheetTitle: string; toInsert: number; toDelete: number; unchanged: number }[] = [];
    let totalInserted = 0, totalDeleted = 0;

    for (const s of sheets) {
      // fetch all existing DB rows for account
      const dbRows: any[] = [];
      const PAGE = 1000;
      let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: page, error } = await supabase
          .from("transactions")
          .select("id,transaction_date,value_date,description,reference,credit,debit,amount")
          .eq("account_id", s.accountId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        dbRows.push(...(page ?? []));
        if (!page || page.length < PAGE) break;
        from += PAGE;
      }

      // build multisets (key -> list of ids for db, or count for sheet)
      const dbByKey = new Map<string, string[]>();
      for (const r of dbRows) {
        const k = rowKey(r);
        const arr = dbByKey.get(k) ?? [];
        arr.push(r.id);
        dbByKey.set(k, arr);
      }
      const sheetKeys: string[] = s.rows.map(rowKey);
      const sheetKeyCounts = new Map<string, number>();
      sheetKeys.forEach((k) => sheetKeyCounts.set(k, (sheetKeyCounts.get(k) ?? 0) + 1));

      // determine inserts: sheet rows whose key count > db count (for that key), pick first extras
      const inserts: SheetRow[] = [];
      const usedDbIds = new Set<string>();
      let unchanged = 0;
      const dbUsedCounts = new Map<string, number>();
      s.rows.forEach((r, idx) => {
        const k = sheetKeys[idx];
        const dbIds = dbByKey.get(k) ?? [];
        const used = dbUsedCounts.get(k) ?? 0;
        if (used < dbIds.length) {
          usedDbIds.add(dbIds[used]);
          dbUsedCounts.set(k, used + 1);
          unchanged++;
        } else {
          inserts.push(r);
        }
      });
      const deleteIds: string[] = [];
      for (const r of dbRows) if (!usedDbIds.has(r.id)) deleteIds.push(r.id);

      perAccount.push({
        accountId: s.accountId,
        accountName: s.accountName,
        sheetTitle: s.sheetTitle,
        toInsert: inserts.length,
        toDelete: deleteIds.length,
        unchanged,
      });

      if (!data.apply) continue;

      // create batch record
      const { data: batch, error: be } = await supabase
        .from("import_batches")
        .insert({
          account_id: s.accountId,
          file_name: `Google Sheets sync (${s.sheetTitle})`,
          row_count: inserts.length,
          created_by: context.userId,
        })
        .select()
        .single();
      if (be) throw be;

      // Resolve lookups + build insert payloads
      const payloads: any[] = [];
      for (const r of inserts) {
        const fundId = r._fund_name ? await ensureLookup("funds", r._fund_name, fundMap) : null;
        const etId = r._expense_type_name ? await ensureLookup("expense_types", r._expense_type_name, etMap) : null;
        const catId = r._category_name ? await ensureLookup("categories", r._category_name, catMap) : null;
        const subId = r._subcategory_name ? await ensureSubcat(r._category_name ?? null, r._subcategory_name as string) : null;
        const out: any = { account_id: s.accountId, import_batch_id: batch.id };
        for (const [k, v] of Object.entries(r)) if (!NAME_FIELDS.has(k)) out[k] = v;
        out.fund_id = fundId;
        out.expense_type_id = etId;
        out.category_id = catId;
        out.subcategory_id = subId;
        if (!out.transaction_date) out.transaction_date = out.value_date ?? null;
        payloads.push(out);
      }
      for (let i = 0; i < payloads.length; i += 500) {
        const chunk = payloads.slice(i, i + 500);
        const { error } = await supabase.from("transactions").insert(chunk as any);
        if (error) throw error;
      }
      totalInserted += payloads.length;

      // Delete in chunks
      for (let i = 0; i < deleteIds.length; i += 200) {
        const chunk = deleteIds.slice(i, i + 200);
        const { error } = await supabase.from("transactions").delete().in("id", chunk);
        if (error) throw error;
      }
      totalDeleted += deleteIds.length;
    }

    return {
      applied: data.apply,
      perAccount,
      skippedSheets: skipped,
      totalInsert: perAccount.reduce((a, x) => a + x.toInsert, 0),
      totalDelete: perAccount.reduce((a, x) => a + x.toDelete, 0),
      totalInserted,
      totalDeleted,
    };
  });
