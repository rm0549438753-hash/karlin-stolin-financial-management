import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { ReportShell, Kpi, nameMap, exportRowsToExcel, type Tx } from "@/routes/_authenticated/reports";
import { exportRowsAsPdf, objectsToTable } from "@/lib/export-pdf";

export function AnomaliesReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const [threshold, setThreshold] = useState<string>("2.5");
  const acctMap = nameMap(lookups.accounts);
  const catMap = nameMap(lookups.categories);

  const groupKeyOf = (t: Tx) => t.payee?.trim() ? `p:${t.payee.trim()}` : `c:${t.category_id ?? "ללא קטגוריה"}`;
  const groupLabelOf = (t: Tx) => t.payee?.trim() || (t.category_id ? catMap.get(t.category_id) ?? "ללא קטגוריה" : "ללא קטגוריה");

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    txs.forEach((t) => {
      const k = groupKeyOf(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return map;
  }, [txs]);

  const anomalies = useMemo(() => {
    const th = Number(threshold);
    const result: { tx: Tx; groupLabel: string; mean: number; std: number; ratio: number }[] = [];
    groups.forEach((rows) => {
      if (rows.length < 5) return; // needs >=4 "other" transactions
      const amounts = rows.map((t) => Math.abs(Number(t.amount)));
      rows.forEach((t, i) => {
        const others = amounts.filter((_, j) => j !== i);
        if (others.length < 4) return;
        const mean = others.reduce((s, x) => s + x, 0) / others.length;
        const variance = others.reduce((s, x) => s + (x - mean) ** 2, 0) / others.length;
        const std = Math.sqrt(variance);
        if (std === 0) return;
        const amt = Math.abs(Number(t.amount));
        const ratio = Math.abs(amt - mean) / std;
        if (ratio >= th) {
          result.push({ tx: t, groupLabel: groupLabelOf(t), mean, std, ratio });
        }
      });
    });
    return result.sort((a, b) => b.ratio - a.ratio);
  }, [groups, threshold]);

  const exportRows = () => anomalies.map((a) => ({
    "תאריך": formatDate(a.tx.transaction_date),
    "חשבון": acctMap.get(a.tx.account_id) ?? "",
    "מוטב/קטגוריה": a.groupLabel,
    "פרטים": a.tx.description ?? "",
    "סכום": Math.abs(Number(a.tx.amount)),
    "ממוצע קבוצה": Math.round(a.mean * 100) / 100,
    "סטיית תקן": Math.round(a.std * 100) / 100,
    "חריגה (σ)": Math.round(a.ratio * 100) / 100,
  }));

  return (
    <ReportShell
      title="זיהוי חריגות"
      subtitle="תנועות שסטו משמעותית מהממוצע ההיסטורי של אותו מוטב/קטגוריה"
      onExport={() => exportRowsToExcel(exportRows(), "זיהוי חריגות.xlsx")}
      onExportPdf={() => {
        const { headers, data } = objectsToTable(exportRows());
        exportRowsAsPdf("זיהוי חריגות", headers, data);
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">סף חריגה:</span>
        <Select value={threshold} onValueChange={setThreshold}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2σ (רגיש)</SelectItem>
            <SelectItem value="2.5">2.5σ (מומלץ)</SelectItem>
            <SelectItem value="3">3σ (מחמיר)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="תנועות חריגות" value={String(anomalies.length)} />
        <Kpi label="החריגה החדה ביותר" value={anomalies[0] ? `${anomalies[0].ratio.toFixed(1)}σ` : "—"} />
        <Kpi label="סכום כולל חריג" value={formatCurrency(anomalies.reduce((s, a) => s + Math.abs(Number(a.tx.amount)), 0))} />
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right border-l">תאריך</TableHead>
              <TableHead className="text-right border-l">חשבון</TableHead>
              <TableHead className="text-right border-l">מוטב/קטגוריה</TableHead>
              <TableHead className="text-right border-l">פרטים</TableHead>
              <TableHead className="text-left border-l">סכום</TableHead>
              <TableHead className="text-left border-l">ממוצע קבוצה</TableHead>
              <TableHead className="text-left">חריגה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anomalies.map((a) => (
              <TableRow key={a.tx.id} className="border-b">
                <TableCell className="border-l">{formatDate(a.tx.transaction_date)}</TableCell>
                <TableCell className="border-l">{acctMap.get(a.tx.account_id) ?? ""}</TableCell>
                <TableCell className="border-l font-medium">{a.groupLabel}</TableCell>
                <TableCell className="border-l">{a.tx.description ?? ""}</TableCell>
                <TableCell className="text-left tabular-nums border-l font-semibold text-expense">{formatCurrency(Math.abs(Number(a.tx.amount)))}</TableCell>
                <TableCell className="text-left tabular-nums border-l">{formatCurrency(a.mean)}</TableCell>
                <TableCell className="text-left tabular-nums font-bold text-expense">{a.ratio.toFixed(1)}σ</TableCell>
              </TableRow>
            ))}
            {anomalies.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">לא נמצאו חריגות בסף שנבחר</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}
