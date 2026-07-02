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
  "מספר צ'ק": "reference",
  "מספר צק": "reference",
  "מס' צ'ק": "reference",
  "מס צ'ק": "reference",
  "צ'ק": "reference",
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
function normRef(v: any): string {
  if (v == null) return "";
  return String(v).replace(/[\s\-_.]/g, "").trim();
}
function serialToDateStr(n: number): string | null {
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

// Compute the effective absolute amount for a row (used as match key)
function absAmount(r: any): number | null {
  if (r.amount != null && !isNaN(Number(r.amount))) return Math.abs(Number(r.amount));
  const c = Number(r.credit) || 0;
  const d = Number(r.debit) || 0;
  if (c || d) return Math.abs(c - d);
  return null;
}

// Match key: absolute amount + reference (check number / asmachta).
// Dates and free-text descriptions are ignored — user does not care about those diffs.
function matchKey(r: any): string {
  const amt = absAmount(r);
  const ref = normRef(r.reference);
  return `${amt == null ? "" : amt.toFixed(2)}|${ref}`;
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
  sheetGid: number | null;
  accountId: string;
  accountName: string;
  schemaType: string;
  rows: SheetRow[];
};

async function parseAllSheets(
  spreadsheetId: string,
  accounts: { id: string; name: string; schema_type: string }[],
): Promise<{ sheets: ParsedSheet[]; skipped: string[] }> {
  const meta = await gatewayFetch(`/google_sheets/v4/spreadsheets/${spreadsheetId}`, {
    fields: "sheets.properties(title,sheetId,gridProperties)",
  });
  const titles: { title: string; sheetGid: number | null; rowCount: number }[] = (meta.sheets ?? []).map((s: any) => ({
    title: s.properties.title,
    sheetGid: s.properties.sheetId ?? null,
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
    let hIdx = 0, best = 0;
    const scanLimit = Math.min(25, aoa.length);
    for (let i = 0; i < scanLimit; i++) {
      const row = aoa[i] ?? [];
      const score = row.reduce((acc: number, c: any) => acc + (getMappedField(c) ? 1 : 0), 0);
      if (score > best) { best = score; hIdx = i; }
    }
    if (best === 0) return;
    const headers = (aoa[hIdx] ?? []).map((h) => normHeader(h));

    const rows: SheetRow[] = [];
    for (let i = hIdx + 1; i < aoa.length; i++) {
      const r = aoa[i] ?? [];
      if (!r.some((c) => c != null && String(c).trim() !== "")) continue;
      const _sheetRowIndex = i + 1; // 1-based row in the sheet
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
      if (obj.amount == null) {
        const c = Number(obj.credit) || 0;
        const d = Number(obj.debit) || 0;
        if (c || d) obj.amount = c - d;
      }
      // For checks account, DB stores debit=|amount|, credit=null, amount=-|amount|.
      if (t.account.schema_type === "checks") {
        if (obj.credit != null && obj.debit == null) {
          obj.debit = obj.credit;
          obj.credit = null;
        }
        if (obj.debit == null && obj.amount != null) {
          obj.debit = Math.abs(Number(obj.amount));
        }
        if (obj.amount != null) obj.amount = -Math.abs(Number(obj.amount));
      }
      // Skip rows without any usable amount — can't insert (DB requires amount).
      if (absAmount(obj) == null) continue;
      obj._sheetRowIndex = _sheetRowIndex;
      rows.push(obj);
    }
    // Stable per-account synthetic IDs
    const occ = new Map<string, number>();
    for (const r of rows) {
      const h = hashSheetRow(r);
      const n = occ.get(h) ?? 0;
      occ.set(h, n + 1);
      r._id = `${h}#${n}`;
    }
    out.push({ sheetTitle: t.title, sheetGid: t.sheetGid, accountId: t.account.id, accountName: t.account.name, schemaType: t.account.schema_type, rows });
  });
  return { sheets: out, skipped };
}

function hashSheetRow(r: any): string {
  const s = JSON.stringify([
    r.transaction_date ?? "", r.value_date ?? "",
    r.description ?? "", r.reference ?? "", r.payee ?? "",
    r.credit ?? "", r.debit ?? "", r.amount ?? "", r.balance ?? "", r.fee ?? "",
    r._fund_name ?? "", r._expense_type_name ?? "", r._category_name ?? "", r._subcategory_name ?? "",
    r.note ?? "",
  ]);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

async function ensureAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: isEditor } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "editor" });
  if (!isAdmin && !isEditor) throw new Error("Forbidden");
}

/**
 * Sync semantics (redesigned):
 *  - MATCH KEY = |amount| + reference (check #/asmachta). Dates + descriptions ignored.
 *  - MATCHED with identical classification (fund/type/category/subcategory) → unchanged.
 *  - MATCHED with different classification → UPDATE in place (no delete+insert).
 *  - Sheet-only (no DB match) → INSERT.
 *  - DB-only (no sheet match) → REVIEW (never auto-deleted; user opts-in per row).
 *
 * Exclusions:
 *   inserts / updates are opt-OUT (included by default, uncheck to skip).
 *   reviewDeleteIds is opt-IN — only DB rows the user explicitly checks are deleted.
 */
export const syncFromGoogleSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    spreadsheetId: string;
    apply: boolean;
    exclusions?: Record<string, {
      insertIds?: string[];
      updatePairIds?: string[]; // pair id = sheet._id
      reviewDeleteIds?: string[]; // opt-IN
    }>;
  }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const supabase = context.supabase;

    const { data: accounts, error: aerr } = await supabase
      .from("accounts")
      .select("id,name,schema_type")
      .eq("is_active", true);
    if (aerr) throw aerr;

    const { sheets, skipped } = await parseAllSheets(data.spreadsheetId, accounts as any);

    // Load lookups
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
      if (!data.apply) return null;
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
      const cn = created.category_id ? (catNameById.get(created.category_id) ?? "") : "";
      const nn = normName(created.name) ?? "";
      subMap.set(`${cn}||${nn}`, created.id);
      subMap.set(`||${nn}`, created.id);
      return created.id;
    }

    // Reverse lookup for enrichment
    const fundNameById = new Map<string, string>();
    (fundsRes.data ?? []).forEach((r: any) => fundNameById.set(r.id, r.name));
    const etNameById = new Map<string, string>();
    (etRes.data ?? []).forEach((r: any) => etNameById.set(r.id, r.name));
    const subNameById = new Map<string, string>();
    (subRes.data ?? []).forEach((r: any) => subNameById.set(r.id, r.name));

    type FullRow = {
      id: string;
      transaction_date: string | null;
      value_date: string | null;
      description: string | null;
      reference: string | null;
      payee: string | null;
      note: string | null;
      credit: number | null;
      debit: number | null;
      amount: number | null;
      balance: number | null;
      fee: number | null;
      fund_name: string | null;
      expense_type_name: string | null;
      category_name: string | null;
      subcategory_name: string | null;
      sheetRowIndex?: number | null;
    };
    type UpdatePair = { sheet: FullRow; db: FullRow; dbId: string };

    const perAccount: {
      accountId: string; accountName: string; sheetTitle: string; sheetGid: number | null; schemaType: string;
      toInsert: number; toUpdate: number; review: number; unchanged: number;
      inserts: FullRow[]; updates: UpdatePair[]; reviewRows: FullRow[];
    }[] = [];
    let totalInserted = 0, totalUpdated = 0, totalDeleted = 0;

    for (const s of sheets) {
      // Fetch all existing rows for this account
      const dbRows: any[] = [];
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data: page, error } = await supabase
          .from("transactions")
          .select("id,transaction_date,value_date,description,reference,credit,debit,amount,balance,fee,payee,note,fund_id,expense_type_id,category_id,subcategory_id")
          .eq("account_id", s.accountId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        dbRows.push(...(page ?? []));
        if (!page || page.length < PAGE) break;
        from += PAGE;
      }

      // Multiset match by (|amount| + reference)
      const dbByKey = new Map<string, string[]>();
      const dbById = new Map<string, any>();
      for (const r of dbRows) {
        const k = matchKey(r);
        const arr = dbByKey.get(k) ?? [];
        arr.push(r.id);
        dbByKey.set(k, arr);
        dbById.set(r.id, r);
      }

      const sheetToFull = (r: SheetRow): FullRow => ({
        id: String(r._id ?? ""),
        transaction_date: r.transaction_date ?? null,
        value_date: r.value_date ?? null,
        description: r.description ?? null,
        reference: r.reference ?? null,
        payee: r.payee ?? null,
        note: r.note ?? null,
        credit: r.credit ?? null,
        debit: r.debit ?? null,
        amount: r.amount ?? null,
        balance: r.balance ?? null,
        fee: r.fee ?? null,
        fund_name: r._fund_name ?? null,
        expense_type_name: r._expense_type_name ?? null,
        category_name: r._category_name ?? null,
        subcategory_name: r._subcategory_name ?? null,
        sheetRowIndex: r._sheetRowIndex ?? null,
      });
      const dbToFull = (r: any): FullRow => ({
        id: String(r.id ?? ""),
        transaction_date: r.transaction_date ?? null,
        value_date: r.value_date ?? null,
        description: r.description ?? null,
        reference: r.reference ?? null,
        payee: r.payee ?? null,
        note: r.note ?? null,
        credit: r.credit == null ? null : Number(r.credit),
        debit: r.debit == null ? null : Number(r.debit),
        amount: r.amount == null ? null : Number(r.amount),
        balance: r.balance == null ? null : Number(r.balance),
        fee: r.fee == null ? null : Number(r.fee),
        fund_name: r.fund_id ? (fundNameById.get(r.fund_id) ?? null) : null,
        expense_type_name: r.expense_type_id ? (etNameById.get(r.expense_type_id) ?? null) : null,
        category_name: r.category_id ? (catNameById.get(r.category_id) ?? null) : null,
        subcategory_name: r.subcategory_id ? (subNameById.get(r.subcategory_id) ?? null) : null,
      });

      const inserts: SheetRow[] = [];
      const updates: UpdatePair[] = [];
      const usedDbIds = new Set<string>();
      let unchanged = 0;
      const dbUsedCounts = new Map<string, number>();

      const normS = (v: any) => (v == null ? "" : String(v).trim());
      for (const r of s.rows) {
        const k = matchKey(r);
        const dbIds = dbByKey.get(k) ?? [];
        const used = dbUsedCounts.get(k) ?? 0;
        if (used < dbIds.length) {
          const dbId = dbIds[used];
          usedDbIds.add(dbId);
          dbUsedCounts.set(k, used + 1);
          const dbRow = dbById.get(dbId);
          const dbFull = dbToFull(dbRow);
          const shFull = sheetToFull(r);
          const classChanged =
            normS(shFull.fund_name) !== normS(dbFull.fund_name) ||
            normS(shFull.expense_type_name) !== normS(dbFull.expense_type_name) ||
            normS(shFull.category_name) !== normS(dbFull.category_name) ||
            normS(shFull.subcategory_name) !== normS(dbFull.subcategory_name);
          // Only update if the sheet actually specifies classification (avoid wiping DB values with empty sheet cells)
          const sheetHasClass =
            shFull.fund_name || shFull.expense_type_name ||
            shFull.category_name || shFull.subcategory_name;
          if (classChanged && sheetHasClass) {
            updates.push({ sheet: shFull, db: dbFull, dbId });
          } else {
            unchanged++;
          }
        } else {
          inserts.push(r);
        }
      }
      const reviewRows: FullRow[] = [];
      for (const r of dbRows) if (!usedDbIds.has(r.id)) reviewRows.push(dbToFull(r));

      // Apply exclusions
      const excl = data.exclusions?.[s.accountId];
      const excludeInsertIds = new Set(excl?.insertIds ?? []);
      const excludeUpdatePairIds = new Set(excl?.updatePairIds ?? []);
      const reviewDeleteIds = new Set(excl?.reviewDeleteIds ?? []); // opt-IN

      const effectiveInserts = inserts.filter((r) => !excludeInsertIds.has(String(r._id ?? "")));
      const effectiveUpdates = updates.filter((u) => !excludeUpdatePairIds.has(u.sheet.id));
      const effectiveDeleteIds = reviewRows
        .filter((r) => reviewDeleteIds.has(r.id))
        .map((r) => r.id);

      perAccount.push({
        accountId: s.accountId,
        accountName: s.accountName,
        sheetTitle: s.sheetTitle,
        sheetGid: s.sheetGid,
        schemaType: s.schemaType,
        toInsert: effectiveInserts.length,
        toUpdate: effectiveUpdates.length,
        review: reviewRows.length,
        unchanged,
        inserts: inserts.map(sheetToFull),
        updates,
        reviewRows,
      });

      if (!data.apply) continue;

      // Batch record for inserts
      if (effectiveInserts.length > 0) {
        const { data: batch, error: be } = await supabase
          .from("import_batches")
          .insert({
            account_id: s.accountId,
            file_name: `Google Sheets sync (${s.sheetTitle})`,
            row_count: effectiveInserts.length,
            created_by: context.userId,
          })
          .select()
          .single();
        if (be) throw be;

        const payloads: any[] = [];
        for (const r of effectiveInserts) {
          const fundId = r._fund_name ? await ensureLookup("funds", r._fund_name, fundMap) : null;
          const etId = r._expense_type_name ? await ensureLookup("expense_types", r._expense_type_name, etMap) : null;
          const catId = r._category_name ? await ensureLookup("categories", r._category_name, catMap) : null;
          const subId = r._subcategory_name ? await ensureSubcat(r._category_name ?? null, r._subcategory_name as string) : null;
          const out: any = { account_id: s.accountId, import_batch_id: batch.id };
          for (const [k, v] of Object.entries(r)) if (!NAME_FIELDS.has(k) && k !== "_id") out[k] = v;
          out.fund_id = fundId;
          out.expense_type_id = etId;
          out.category_id = catId;
          out.subcategory_id = subId;
          if (!out.transaction_date) out.transaction_date = out.value_date ?? null;
          // Safety: never insert with null/undefined amount (DB NOT NULL)
          if (out.amount == null) {
            const c = Number(out.credit) || 0;
            const d = Number(out.debit) || 0;
            if (c || d) out.amount = c - d;
            else continue;
          }
          payloads.push(out);
        }
        for (let i = 0; i < payloads.length; i += 500) {
          const chunk = payloads.slice(i, i + 500);
          const { error } = await supabase.from("transactions").insert(chunk as any);
          if (error) throw error;
        }
        totalInserted += payloads.length;
      }

      // In-place UPDATES (classification only)
      for (const u of effectiveUpdates) {
        const fundId = u.sheet.fund_name ? await ensureLookup("funds", u.sheet.fund_name, fundMap) : null;
        const etId = u.sheet.expense_type_name ? await ensureLookup("expense_types", u.sheet.expense_type_name, etMap) : null;
        const catId = u.sheet.category_name ? await ensureLookup("categories", u.sheet.category_name, catMap) : null;
        const subId = u.sheet.subcategory_name ? await ensureSubcat(u.sheet.category_name ?? null, u.sheet.subcategory_name) : null;
        const patch: any = { updated_by: context.userId };
        // Only apply fields the sheet actually specifies (don't wipe existing DB values with blanks)
        if (u.sheet.fund_name) patch.fund_id = fundId;
        if (u.sheet.expense_type_name) patch.expense_type_id = etId;
        if (u.sheet.category_name) patch.category_id = catId;
        if (u.sheet.subcategory_name) patch.subcategory_id = subId;
        const { error } = await supabase.from("transactions").update(patch).eq("id", u.dbId);
        if (error) throw error;
        totalUpdated++;
      }

      // Opt-in DELETES from review
      for (let i = 0; i < effectiveDeleteIds.length; i += 200) {
        const chunk = effectiveDeleteIds.slice(i, i + 200);
        const { error } = await supabase.from("transactions").delete().in("id", chunk);
        if (error) throw error;
      }
      totalDeleted += effectiveDeleteIds.length;
    }

    return {
      applied: data.apply,
      perAccount,
      skippedSheets: skipped,
      totalInsert: perAccount.reduce((a, x) => a + x.toInsert, 0),
      totalUpdate: perAccount.reduce((a, x) => a + x.toUpdate, 0),
      totalReview: perAccount.reduce((a, x) => a + x.review, 0),
      totalInserted,
      totalUpdated,
      totalDeleted,
    };
  });
