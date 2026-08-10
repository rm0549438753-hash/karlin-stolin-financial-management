import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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

export function PayeesReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const acctMap = nameMap(lookups.accounts);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    txs.forEach((t) => {
      const p = t.payee?.trim() || "ללא מוטב";
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(t);
    });
    return map;
  }, [txs]);

  // Detect near-duplicate payee names via normalized key.
  const dupSets = useMemo(() => {
    const byNorm = new Map<string, string[]>();
    groups.forEach((_, payee) => {
      if (payee === "ללא מוטב") return;
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
      const dates = rows.map((t) => t.transaction_date).sort();
      const first = dates[0];
      const last = dates[dates.length - 1];
      const avg = total / count;
      const daySpan = (new Date(last).getTime() - new Date(first).getTime()) / 86400000;
      const avgGapDays = count > 1 ? daySpan / (count - 1) : 0;
      const frequency = count < 2 ? "יחיד" : avgGapDays <= 10 ? "שבועי" : avgGapDays <= 40 ? "חודשי" : avgGapDays <= 100 ? "רבעוני" : "לא סדיר";
      return { payee, rows, total, count, first, last, avg, frequency, dup: dupSets.get(payee) };
    });
    const q = search.trim().toLowerCase();
    const filtered = q ? arr.filter((r) => r.payee.toLowerCase().includes(q)) : arr;
    filtered.sort((a, b) => {
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
  }, [groups, search, sortKey, sortDir, dupSets]);

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
      subtitle="ריכוז תנועות לפי מוטב, עם זיהוי שמות דומים/כפולים"
      onExport={() => exportRowsToExcel(exportRows(), "דוח מוטבים.xlsx")}
      onExportPdf={() => {
        const { headers, data } = objectsToTable(exportRows());
        exportRowsAsPdf("דוח מוטבים", headers, data);
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="מס׳ מוטבים" value={String(rows.length)} />
        <Kpi label="סה״כ שולם" value={formatCurrency(totalPaid)} />
        <Kpi label="שמות אפשריים כפולים" value={String(dupCount)} />
        <Kpi label="מס׳ תנועות" value={String(txs.length)} />
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש מוטב" className="pr-9" />
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
                            {[...r.rows].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)).map((t) => (
                              <TableRow key={t.id}>
                                <TableCell className="border-l">{formatDate(t.transaction_date)}</TableCell>
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
