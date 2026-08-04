import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet } from "lucide-react";
import type { Account } from "@/hooks/use-lookups";

// header → transactions column mapping (Hebrew headers from the Excel)
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
  // classification columns (resolved to *_id after lookup)
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

const HEADER_FIELD_MAP = new Map(Object.entries(HEADER_MAP).map(([header, field]) => [normHeader(header), field]));

function getMappedField(header: any): string | undefined {
  return HEADER_FIELD_MAP.get(normHeader(header));
}

function normName(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/\s+/g, " ");
  return s === "" ? null : s;
}

function toDateStr(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
    // Fallback: build from UTC components to avoid TZ shift
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }
  const s = String(v).trim();
  // ISO yyyy-mm-dd (with optional time) — parse directly to avoid TZ shift
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, mo, d] = iso;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // dd/mm/yyyy or dd.mm.yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? "20" + y : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const mo = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,₪\s]/g, ""));
  return isNaN(n) ? null : n;
}

export function ImportDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account: Account | null }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: any[]; headers: string[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pickFile(f: File) {
    setFile(f);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // read as array-of-arrays so we can locate the real header row
    const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, blankrows: false });
    // find the row with the most known headers (scan first 25 rows)
    let headerIdx = 0;
    let bestScore = 0;
    const scanLimit = Math.min(25, aoa.length);
    for (let i = 0; i < scanLimit; i++) {
      const row = aoa[i] ?? [];
      const score = row.reduce((acc: number, cell: any) => {
        return acc + (getMappedField(cell) ? 1 : 0);
      }, 0);
      if (score > bestScore) { bestScore = score; headerIdx = i; }
    }
    const rawHeaders = (aoa[headerIdx] ?? []).map((h: any, i: number) =>
      normHeader(h) === "" ? `__col_${i}` : normHeader(h)
    );
    // indices of date columns + amount columns (a real txn row has any date OR any amount)
    const txnDateIdx = rawHeaders.findIndex((h) => getMappedField(h) === "transaction_date");
    const valDateIdx = rawHeaders.findIndex((h) => getMappedField(h) === "value_date");
    const amountIdxs = rawHeaders
      .map((h, i) => ({ f: getMappedField(h), i }))
      .filter((x) => x.f === "credit" || x.f === "debit" || x.f === "amount")
      .map((x) => x.i);
    const dataRows = aoa.slice(headerIdx + 1).filter((r) => {
      if (!r.some((c) => c != null && String(c).trim() !== "")) return false;
      const hasTxnDate = txnDateIdx >= 0 && toDateStr(r[txnDateIdx]) != null;
      const hasValDate = valDateIdx >= 0 && toDateStr(r[valDateIdx]) != null;
      const hasAmount = amountIdxs.some((i) => toNum(r[i]) != null && toNum(r[i]) !== 0);
      // accept if there's any date or any amount — filters out only totals/notes/empty rows
      if (txnDateIdx < 0 && valDateIdx < 0) return true;
      return hasTxnDate || hasValDate || hasAmount;
    });
    const rows = dataRows.map((r) => {
      const obj: Record<string, any> = {};
      rawHeaders.forEach((h, i) => { obj[h] = r[i] ?? null; });
      return obj;
    });
    setPreview({ rows, headers: rawHeaders });
  }

  const importMut = useMutation({
    mutationFn: async () => {
      if (!account || !preview) throw new Error("חסר חשבון או קובץ");
      const { data: userData } = await supabase.auth.getUser();
      // create batch
      const { data: batch, error: be } = await supabase
        .from("import_batches")
        .insert({ account_id: account.id, file_name: file?.name ?? "import.xlsx", row_count: preview.rows.length, created_by: userData.user?.id ?? null })
        .select()
        .single();
      if (be) throw be;

      // 1) parse rows into a normalized shape (with name fields)
      const parsed = preview.rows.map((r) => {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) {
          const field = getMappedField(k);
          if (!field) continue;
          if (DATE_FIELDS.has(field)) out[field] = toDateStr(v);
          else if (NUM_FIELDS.has(field)) out[field] = toNum(v);
          else if (NAME_FIELDS.has(field)) out[field] = normName(v);
          else if (field === "future_check") out[field] = v === true || String(v).trim() === "✓" || String(v).trim() === "כן";
          else out[field] = v == null ? null : String(v);
        }
        return out;
      });

      // 2) collect distinct lookup names
      const uniq = (arr: (string | null | undefined)[]) =>
        Array.from(new Set(arr.filter((x): x is string => !!x)));
      const fundNames = uniq(parsed.map((r) => r._fund_name));
      const etNames = uniq(parsed.map((r) => r._expense_type_name));
      const catNames = uniq(parsed.map((r) => r._category_name));
      const subNames = uniq(parsed.map((r) => r._subcategory_name));

      // 3) load existing lookups and create missing ones
      async function resolveLookup(table: "funds" | "expense_types" | "categories", names: string[]) {
        const map = new Map<string, string>();
        if (names.length === 0) return map;
        const { data: existing, error } = await supabase.from(table).select("id,name");
        if (error) throw error;
        (existing ?? []).forEach((r: any) => map.set(normName(r.name) ?? "", r.id));
        const missing = names.filter((n) => !map.has(n));
        if (missing.length) {
          const { data: created, error: ce } = await supabase
            .from(table)
            .insert(missing.map((name) => ({ name })))
            .select("id,name");
          if (ce) throw ce;
          (created ?? []).forEach((r: any) => map.set(normName(r.name) ?? "", r.id));
        }
        return map;
      }
      const fundMap = await resolveLookup("funds", fundNames);
      const etMap = await resolveLookup("expense_types", etNames);
      const catMap = await resolveLookup("categories", catNames);

      // subcategories: need category_id, fall back to any category
      const subMap = new Map<string, string>(); // key = `${catName}||${subName}` and also `||${subName}`
      if (subNames.length) {
        const { data: existingSubs, error } = await supabase.from("subcategories").select("id,name,category_id");
        if (error) throw error;
        const catNameById = new Map<string, string>();
        catMap.forEach((id, name) => catNameById.set(id, name));
        (existingSubs ?? []).forEach((r: any) => {
          const n = normName(r.name) ?? "";
          const cn = catNameById.get(r.category_id);
          if (cn) subMap.set(`${cn}||${n}`, r.id);
          else subMap.set(`||${n}`, r.id);
        });
        // create missing per (category, subname)
        const toCreate: { name: string; category_id: string; key: string }[] = [];
        for (const row of parsed) {
          const sn = row._subcategory_name;
          if (!sn) continue;
          const cn = row._category_name;
          const key = `${cn ?? ""}||${sn}`;
          if (subMap.has(key)) continue;
          const cid = cn ? catMap.get(cn) : null;
          if (!cid) continue; // can't create without category
          if (toCreate.some((t) => t.key === key)) continue;
          toCreate.push({ name: sn, category_id: cid, key });
        }
        if (toCreate.length) {
          const { data: created, error: ce } = await supabase
            .from("subcategories")
            .insert(toCreate.map(({ name, category_id }) => ({ name, category_id })))
            .select("id,name,category_id");
          if (ce) throw ce;
          (created ?? []).forEach((r: any) => {
            const n = normName(r.name) ?? "";
            const cn = catNameById.get(r.category_id) ?? "";
            subMap.set(`${cn}||${n}`, r.id);
            subMap.set(`||${n}`, r.id);
          });
        }
      }

      // 4) build final rows — import everything; default missing amount to 0
      const txRows = parsed.map((r) => {
        const out: Record<string, any> = { account_id: account.id, import_batch_id: batch.id };
        for (const [k, v] of Object.entries(r)) {
          if (NAME_FIELDS.has(k)) continue;
          out[k] = v;
        }
        if (r._fund_name) out.fund_id = fundMap.get(r._fund_name) ?? null;
        if (r._expense_type_name) out.expense_type_id = etMap.get(r._expense_type_name) ?? null;
        if (r._category_name) out.category_id = catMap.get(r._category_name) ?? null;
        if (r._subcategory_name) {
          const cn = r._category_name ?? "";
          out.subcategory_id = subMap.get(`${cn}||${r._subcategory_name}`) ?? subMap.get(`||${r._subcategory_name}`) ?? null;
        }
        if (out.amount == null) {
          const c = Number(out.credit) || 0;
          const d = Number(out.debit) || 0;
          if (c || d) out.amount = c - d;
        }
        // DB requires non-null amount — default to 0 for empty rows so we still import them
        if (out.amount == null || Number.isNaN(Number(out.amount))) out.amount = 0;
        // Checks are outgoing payments — enforce negative amount so income/expense calc is correct
        if (account.schema_type === "checks" && Number(out.amount) > 0) {
          out.amount = -Number(out.amount);
          out.debit = Math.abs(Number(out.amount));
          out.credit = null;
        }
        if (!out.transaction_date) out.transaction_date = out.value_date ?? null;
        if (!out.transaction_date) out.transaction_date = new Date().toISOString().slice(0, 10);
        return out;
      });

      // insert in chunks of 500
      for (let i = 0; i < txRows.length; i += 500) {
        const chunk = txRows.slice(i, i + 500);
        const { error } = await supabase.from("transactions").insert(chunk as any);
        if (error) throw error;
      }
      return { count: txRows.length };
    },
    onSuccess: (res) => {
      toast.success(`יובאו ${res.count} תנועות`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
      qc.invalidateQueries({ queryKey: ["funds"] });
      qc.invalidateQueries({ queryKey: ["expense-types"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["subcategories"] });
      setFile(null); setPreview(null);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאת ייבוא"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setFile(null); setPreview(null); } onOpenChange(o); }}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ייבוא תנועות מאקסל</DialogTitle>
          <DialogDescription>
            {account ? `ייבוא לחשבון: ${account.name}` : "בחר חשבון תחילה"} · קובץ xlsx, גליון יחיד. כותרות יזוהו אוטומטית (תאריך, זכות, חובה, תיאור וכו׳).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-2xl py-10 flex flex-col items-center justify-center gap-2 hover:bg-muted/40 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div className="text-sm font-medium">לחץ לבחירת קובץ Excel</div>
              <div className="text-xs text-muted-foreground">.xlsx / .xls</div>
            </button>
          ) : (
            <div className="border rounded-xl p-4 bg-muted/30 flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null); }}>החלפה</Button>
            </div>
          )}

          {preview && (
            <div className="border rounded-xl p-4 bg-muted/30 text-center">
              <div className="text-3xl font-bold text-primary">{preview.rows.length}</div>
              <div className="text-sm text-muted-foreground mt-1">תנועות מוכנות לייבוא</div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button
            disabled={!account || !preview || preview.rows.length === 0 || importMut.isPending}
            onClick={() => importMut.mutate()}
          >
            {importMut.isPending ? "מייבא…" : `ייבא ${preview?.rows.length ?? 0} תנועות`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
