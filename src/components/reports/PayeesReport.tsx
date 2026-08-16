import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { ReportShell, Kpi, nameMap, exportRowsToExcel, type Tx } from "@/routes/_authenticated/reports";
import { exportRowsAsPdf, objectsToTable } from "@/lib/export-pdf";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, Copy } from "lucide-react";

function normalizePayee(name: string) {
  return name
    .toLowerCase()
    .replace(/["'׳״.]/g, "")
    .replace(/\b(בעמ|בע"מ|ltd|inc|co|חברת|עמותת|עמותה)\b/g, "")
    .replace(/\s+/g, "")
    .trim();
}

type SortKey = "payee" | "total" | "count" | "avg" | "first" | "last";

export const TECHNICAL_LABEL = "תנועות טכניות – ללא מוטב";

/** Prefixes that introduce a real name: "העברה ל<שם>", "זיכוי מ<שם>" … */
const NAME_PREFIXES = [
  "העברה לטובת", "העברה ל", "העברה מ", "העברת כספים ל", "זיכוי מ", "זיכוי ל",
  "חיוב מ", "תשלום ל", "תשלום מ", "לפקודת", "לטובת", "ע\"ש", "עש",
  "הפקדה מ", "הפקדת", "מאת", "עבור",
];

/** Words that mean the row is a bank/technical operation, not a beneficiary. */
const TECHNICAL_WORDS = [
  "משיכת צק", "משיכת שיק", "משיכת צ'ק", "משיכה", "עמלה", "עמלות", "עמלת",
  "ריבית", "מס", "מסי", "ניכוי", "החזר", "הפקדה", "הפקדת מזומן", "מזומן",
  "כספומט", "העברה בנקאית", "העברה עצמית", "העברה", "זיכוי", "חיוב",
  "הוראת קבע", "הו\"ק", "הקצאה", "יתרה", "תשלום", "שער", "דמי ניהול",
  "כרטיס אשראי", "אשראי", "שיק", "צק", "צ'ק", "צ׳ק", "בנק", "פרעון", "פירעון",
];

function cleanupName(raw: string): string {
  return raw
    .replace(/^[\s\-–—:,.·|/\\]+/, "")
    .replace(/[\s\-–—:,.·|/\\]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function looksLikeName(s: string): boolean {
  if (s.length < 2) return false;
  // Must contain letters, not just digits / reference numbers.
  if (!/[\u0590-\u05FFa-zA-Z]{2,}/.test(s)) return false;
  if (/^\d+$/.test(s.replace(/\D/g, "") ) && !/[\u0590-\u05FFa-zA-Z]/.test(s)) return false;
  const bare = s.replace(/["'׳״.\-]/g, "").trim();
  if (TECHNICAL_WORDS.some((w) => bare === w.replace(/["'׳״.\-]/g, ""))) return false;
  return true;
}

/**
 * Extracts a person/company name for the report. A real `payee` value always
 * wins. Otherwise we try to pull a name out of the description
 * ("העברה לישראל כהן" -> "ישראל כהן"); technical rows such as "משיכת צ'ק"
 * or "עמלה" are grouped under a single technical bucket instead of polluting
 * the beneficiary list.
 */
export function extractPayee(t: any): string {
  const direct = typeof t.payee === "string" ? t.payee.trim() : "";
  if (direct) return direct;
  const payer = typeof t.payer_name === "string" ? t.payer_name.trim() : "";
  if (payer) return payer;

  for (const src of [t.description, t.reference, t.note]) {
    const text = typeof src === "string" ? cleanupName(src) : "";
    if (!text) continue;

    for (const p of NAME_PREFIXES) {
      if (text.startsWith(p)) {
        const rest = cleanupName(text.slice(p.length));
        if (looksLikeName(rest)) return rest;
      }
    }

    // No prefix: accept the text only when it does not start with a
    // technical operation word.
    const firstWord = text.split(/\s+/)[0].replace(/["'׳״.\-]/g, "");
    const isTechnical = TECHNICAL_WORDS.some(
      (w) => firstWord === w.replace(/["'׳״.\-]/g, "") || text.startsWith(w),
    );
    if (!isTechnical && looksLikeName(text)) return text;
  }

  return TECHNICAL_LABEL;
}

function payeeOf(t: any): string {
  return extractPayee(t);
}


export function PayeesReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("all");
  const [expenseTypeId, setExpenseTypeId] = useState("all");
  const [direction, setDirection] = useState<"all" | "expense" | "income">("expense");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const acctMap = nameMap(lookups.accounts);

  // Checks rows carry only value_date, so the effective date must follow the
  // same rule the dashboard uses, otherwise every check payee disappears.
  const checksIds = useMemo(
    () => new Set((lookups.accounts as any[]).filter((a) => a.schema_type === "checks").map((a) => a.id)),
    [lookups.accounts],
  );
  const effDate = useMemo(
    () => (t: any): string | null =>
      checksIds.has(t.account_id)
        ? (t.value_date ?? t.transaction_date ?? null)
        : (t.transaction_date ?? t.value_date ?? null),
    [checksIds],
  );

  const scoped = useMemo(() => {
    return txs.filter((t: any) => {
      if (accountId !== "all" && t.account_id !== accountId) return false;
      if (expenseTypeId !== "all") {
        if (expenseTypeId === "none") {
          if (t.expense_type_id) return false;
        } else if (t.expense_type_id !== expenseTypeId) return false;
      }
      const amt = Number(t.amount) || 0;
      if (direction === "expense" && amt >= 0) return false;
      if (direction === "income" && amt <= 0) return false;
      const d = effDate(t);
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      return true;
    });
  }, [txs, accountId, expenseTypeId, direction, from, to, effDate]);


  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    scoped.forEach((t) => {
      const p = payeeOf(t);
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(t);
    });
    return map;
  }, [scoped]);



  // Detect near-duplicate payee names via normalized key.
  const dupSets = useMemo(() => {
    const byNorm = new Map<string, string[]>();
    groups.forEach((_, payee) => {
      if (payee === TECHNICAL_LABEL) return;
      const norm = normalizePayee(payee);
      if (!norm) return;
      if (!byNorm.has(norm)) byNorm.set(norm, []);
      byNorm.get(norm)!.push(payee);
    });
    const dupMap = new Map<string, string[]>();
    byNorm.forEach((names) => {
      if (names.length > 1) names.forEach((n) => dupMap.set(n, names.filter((x) => x !== n)));
    });
    return dupMap;
  }, [groups]);

  const rows = useMemo(() => {
    const arr = Array.from(groups.entries()).map(([payee, rows]) => {
      const total = rows.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const count = rows.length;
      const dates = rows.map((t) => effDate(t)).filter(Boolean).sort() as string[];
      const first = dates[0] ?? "";
      const last = dates[dates.length - 1] ?? "";
      const avg = total / count;
      const daySpan = first && last ? (new Date(last).getTime() - new Date(first).getTime()) / 86400000 : 0;
      const avgGapDays = count > 1 ? daySpan / (count - 1) : 0;
      const frequency = count < 2 ? "יחיד" : avgGapDays <= 10 ? "שבועי" : avgGapDays <= 40 ? "חודשי" : avgGapDays <= 100 ? "רבעוני" : "לא סדיר";
      return { payee, rows, total, count, first, last, avg, frequency, dup: dupSets.get(payee) };
    });
    const q = search.trim().toLowerCase();
    const filtered = q ? arr.filter((r) => r.payee.toLowerCase().includes(q)) : arr;
    filtered.sort((a, b) => {
      // The technical bucket always stays at the bottom.
      if (a.payee === TECHNICAL_LABEL) return 1;
      if (b.payee === TECHNICAL_LABEL) return -1;
      let cmp = 0;
      switch (sortKey) {
        case "payee": cmp = a.payee.localeCompare(b.payee, "he"); break;
        case "total": cmp = a.total - b.total; break;
        case "count": cmp = a.count - b.count; break;
        case "avg": cmp = a.avg - b.avg; break;
        case "first": cmp = a.first.localeCompare(b.first); break;
        case "last": cmp = a.last.localeCompare(b.last); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return filtered;
  }, [groups, search, sortKey, sortDir, dupSets, effDate]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? <ChevronsUpDown className="w-3.5 h-3.5 inline mr-1 opacity-40" /> :
    sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5 inline mr-1" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-1" />;

  const totalPaid = rows.reduce((s, r) => s + r.total, 0);
  const dupCount = new Set(Array.from(dupSets.keys())).size;

  const exportRows = () => rows.map((r) => ({
    "מוטב": r.payee,
    "סה\"כ שולם": r.total,
    "מס' תנועות": r.count,
    "ממוצע": Math.round(r.avg * 100) / 100,
    "תאריך ראשון": formatDate(r.first),
    "תאריך אחרון": formatDate(r.last),
    "תדירות": r.frequency,
    "שם דומה": r.dup?.join(", ") ?? "",
  }));

  return (
    <ReportShell
      title="דוח מוטבים"
      subtitle="שמות אנשים וחברות בלבד — תנועות בנקאיות טכניות מרוכזות בשורה נפרדת"
      onExport={() => exportRowsToExcel(exportRows(), "דוח מוטבים.xlsx")}
      onExportPdf={() => {
        const { headers, data } = objectsToTable(exportRows());
        exportRowsAsPdf("דוח מוטבים", headers, data);
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="מס׳ מוטבים" value={String(rows.filter((r) => r.payee !== TECHNICAL_LABEL).length)} />
        <Kpi label="סה״כ שולם" value={formatCurrency(totalPaid)} />
        <Kpi label="שמות אפשריים כפולים" value={String(dupCount)} />
        <Kpi label="מס׳ תנועות" value={String(scoped.length)} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש מוטב" className="pr-9" />
        </div>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="חשבון" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל החשבונות</SelectItem>
            {lookups.accounts.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="סוג" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסוגים</SelectItem>
            <SelectItem value="none">ללא סוג</SelectItem>
            {(lookups.expenseTypes ?? []).map((e: any) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">הוצאות בלבד</SelectItem>
            <SelectItem value="income">הכנסות בלבד</SelectItem>
            <SelectItem value="all">הכל</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
      </div>


      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right border-l cursor-pointer select-none" onClick={() => toggleSort("payee")}><SortIcon col="payee" />מוטב</TableHead>
              <TableHead className="text-left border-l cursor-pointer select-none" onClick={() => toggleSort("total")}><SortIcon col="total" />סה״כ שולם</TableHead>
              <TableHead className="text-left border-l cursor-pointer select-none" onClick={() => toggleSort("count")}><SortIcon col="count" />מס׳ תנועות</TableHead>
              <TableHead className="text-left border-l cursor-pointer select-none" onClick={() => toggleSort("avg")}><SortIcon col="avg" />ממוצע</TableHead>
              <TableHead className="text-right border-l cursor-pointer select-none" onClick={() => toggleSort("first")}><SortIcon col="first" />ראשון</TableHead>
              <TableHead className="text-right border-l cursor-pointer select-none" onClick={() => toggleSort("last")}><SortIcon col="last" />אחרון</TableHead>
              <TableHead className="text-right">תדירות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <>
                <TableRow
                  key={r.payee}
                  className="border-b cursor-pointer hover:bg-primary/5"
                  onClick={() => setExpanded(expanded === r.payee ? null : r.payee)}
                >
                  <TableCell className="font-medium border-l">
                    <div className="flex items-center gap-2">
                      {r.payee}
                      {r.dup && (
                        <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1" title={`שמות דומים: ${r.dup.join(", ")}`}>
                          <Copy className="w-3 h-3" />כפילות אפשרית
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-left tabular-nums border-l">{formatCurrency(r.total)}</TableCell>
                  <TableCell className="text-left tabular-nums border-l">{r.count}</TableCell>
                  <TableCell className="text-left tabular-nums border-l">{formatCurrency(r.avg)}</TableCell>
                  <TableCell className="text-right border-l">{formatDate(r.first)}</TableCell>
                  <TableCell className="text-right border-l">{formatDate(r.last)}</TableCell>
                  <TableCell className="text-right">{r.frequency}</TableCell>
                </TableRow>
                {expanded === r.payee && (
                  <TableRow key={r.payee + "-detail"} className="bg-muted/20">
                    <TableCell colSpan={7} className="p-0">
                      <div className="p-3">
                        <Table className="border-collapse">
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead className="text-right border-l">תאריך</TableHead>
                              <TableHead className="text-right border-l">חשבון</TableHead>
                              <TableHead className="text-right border-l">פרטים</TableHead>
                              <TableHead className="text-left">סכום</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...r.rows].sort((a, b) => (effDate(b) ?? "").localeCompare(effDate(a) ?? "")).map((t) => (
                              <TableRow key={t.id}>
                                <TableCell className="border-l">{formatDate(effDate(t))}</TableCell>
                                <TableCell className="border-l">{acctMap.get(t.account_id) ?? ""}</TableCell>
                                <TableCell className="border-l">{t.description ?? ""}</TableCell>
                                <TableCell className="text-left tabular-nums">{formatCurrency(Number(t.amount))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">אין נתונים</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}
