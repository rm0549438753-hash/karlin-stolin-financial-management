import { useRef, useState } from "react";
import * as XLSX from "xlsx";
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
};

const DATE_FIELDS = new Set(["transaction_date", "value_date"]);
const NUM_FIELDS = new Set(["credit", "debit", "amount", "balance", "fee"]);

function toDateStr(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy or dd.mm.yyyy
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? "20" + y : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
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
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    setPreview({ rows, headers });
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

      const txRows = preview.rows.map((r) => {
        const out: Record<string, any> = { account_id: account.id, import_batch_id: batch.id };
        for (const [k, v] of Object.entries(r)) {
          const field = HEADER_MAP[String(k).trim()];
          if (!field) continue;
          if (DATE_FIELDS.has(field)) out[field] = toDateStr(v);
          else if (NUM_FIELDS.has(field)) out[field] = toNum(v);
          else if (field === "future_check") out[field] = v === true || String(v).trim() === "✓" || String(v).trim() === "כן";
          else out[field] = v == null ? null : String(v);
        }
        // derive amount if missing
        if (out.amount == null) {
          const c = Number(out.credit) || 0;
          const d = Number(out.debit) || 0;
          if (c || d) out.amount = c - d;
        }
        if (!out.transaction_date) out.transaction_date = new Date().toISOString().slice(0, 10);
        return out;
      });

      // insert in chunks of 500
      for (let i = 0; i < txRows.length; i += 500) {
        const chunk = txRows.slice(i, i + 500);
        const { error } = await supabase.from("transactions").insert(chunk);
        if (error) throw error;
      }
      return { count: txRows.length };
    },
    onSuccess: (res) => {
      toast.success(`יובאו ${res.count} תנועות`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      qc.invalidateQueries({ queryKey: ["tx-dashboard"] });
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
                <div className="text-xs text-muted-foreground">{preview?.rows.length ?? 0} שורות · {preview?.headers.length ?? 0} עמודות</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPreview(null); }}>החלפה</Button>
            </div>
          )}

          {preview && preview.rows.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <div className="text-xs font-medium px-3 py-2 bg-muted/50 border-b">תצוגה מקדימה (5 שורות ראשונות)</div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      {preview.headers.map((h) => (
                        <th key={h} className="px-2 py-1.5 text-right whitespace-nowrap border-l last:border-l-0">
                          {h}
                          {HEADER_MAP[h.trim()] && <span className="block text-[10px] text-success">✓ מזוהה</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-t">
                        {preview.headers.map((h) => (
                          <td key={h} className="px-2 py-1.5 border-l last:border-l-0 whitespace-nowrap">
                            {r[h] instanceof Date ? r[h].toLocaleDateString("he-IL") : String(r[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
