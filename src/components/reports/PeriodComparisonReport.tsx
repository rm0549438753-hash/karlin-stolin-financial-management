import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { ReportShell, Kpi, nameMap, exportRowsToExcel, type Tx } from "@/routes/_authenticated/reports";
import { exportRowsAsPdf, objectsToTable } from "@/lib/export-pdf";

type Mode = "yoy" | "mom";
type Breakdown = "none" | "fund" | "expenseType";

function pctChange(prev: number, curr: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function PctCell({ value }: { value: number | null }) {
  if (value == null) return <TableCell className="text-left tabular-nums">—</TableCell>;
  const cls = value > 0 ? "text-income" : value < 0 ? "text-expense" : "";
  return (
    <TableCell className={`text-left tabular-nums font-semibold ${cls}`}>
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </TableCell>
  );
}

export function PeriodComparisonReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const [mode, setMode] = useState<Mode>("mom");
  const [breakdown, setBreakdown] = useState<Breakdown>("none");

  const bucketOf = (t: Tx) => (mode === "yoy" ? t.transaction_date.slice(0, 4) : t.transaction_date.slice(0, 7));

  const buckets = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    txs.forEach((t) => {
      const key = bucketOf(t);
      const e = map.get(key) ?? { income: 0, expense: 0 };
      const a = Number(t.amount);
      if (a > 0) e.income += a; else e.expense += -a;
      map.set(key, e);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({ key, ...v, net: v.income - v.expense }));
  }, [txs, mode]);

  const labelOf = (key: string) => {
    if (mode === "yoy") return key;
    const d = new Date(key + "-01");
    return new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long" }).format(d);
  };

  const rows = useMemo(() => {
    return buckets.map((b, i) => {
      const prev = buckets[i - 1];
      return {
        ...b,
        label: labelOf(b.key),
        changeNet: prev ? pctChange(prev.net, b.net) : null,
      };
    });
  }, [buckets, mode]);

  const periodKeys = buckets.map((b) => b.key);
  const [periodA, setPeriodA] = useState<string>("");
  const [periodB, setPeriodB] = useState<string>("");
  const effA = periodA || periodKeys[periodKeys.length - 2] || periodKeys[0] || "";
  const effB = periodB || periodKeys[periodKeys.length - 1] || "";

  const groupMap = useMemo(() => {
    if (breakdown === "none") return null;
    return breakdown === "fund" ? nameMap(lookups.funds) : nameMap(lookups.expenseTypes);
  }, [breakdown, lookups]);

  const breakdownRows = useMemo(() => {
    if (breakdown === "none" || !effA || !effB) return [];
    const idField = breakdown === "fund" ? "fund_id" : "expense_type_id";
    const groups = new Map<string, { a: number; b: number }>();
    txs.forEach((t) => {
      const key = bucketOf(t);
      if (key !== effA && key !== effB) return;
      const gid = (t as any)[idField] as string | null;
      const label = gid ? groupMap?.get(gid) ?? "לא ידוע" : "לא משויך";
      const e = groups.get(label) ?? { a: 0, b: 0 };
      const amt = Math.abs(Number(t.amount));
      if (key === effA) e.a += amt; else e.b += amt;
      groups.set(label, e);
    });
    return Array.from(groups.entries())
      .map(([label, v]) => ({ label, ...v, change: pctChange(v.a, v.b) }))
      .sort((x, y) => y.b - x.b);
  }, [breakdown, effA, effB, txs, groupMap, mode]);

  const kpiA = buckets.find((b) => b.key === effA);
  const kpiB = buckets.find((b) => b.key === effB);

  const exportRows = () => rows.map((r) => ({
    "תקופה": r.label,
    "הכנסות": r.income,
    "הוצאות": r.expense,
    "נטו": r.net,
    "שינוי % (נטו)": r.changeNet != null ? r.changeNet.toFixed(1) : "",
  }));

  return (
    <ReportShell
      title="השוואת תקופות"
      subtitle="השוואה בין תקופות — שנה מול שנה או חודש מול חודש"
      onExport={() => exportRowsToExcel(exportRows(), "השוואת תקופות.xlsx")}
      onExportPdf={() => {
        const { headers, data } = objectsToTable(exportRows());
        exportRowsAsPdf("השוואת תקופות", headers, data);
      }}
    >
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={mode} onValueChange={(v) => { setMode(v as Mode); setPeriodA(""); setPeriodB(""); }}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mom">חודש מול חודש</SelectItem>
            <SelectItem value="yoy">שנה מול שנה</SelectItem>
          </SelectContent>
        </Select>

        <Select value={effA} onValueChange={setPeriodA}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="תקופה א׳" /></SelectTrigger>
          <SelectContent>
            {periodKeys.map((k) => <SelectItem key={k} value={k}>{labelOf(k)}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">מול</span>
        <Select value={effB} onValueChange={setPeriodB}>
          <SelectTrigger className="w-48 h-9"><SelectValue placeholder="תקופה ב׳" /></SelectTrigger>
          <SelectContent>
            {periodKeys.map((k) => <SelectItem key={k} value={k}>{labelOf(k)}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={breakdown} onValueChange={(v) => setBreakdown(v as Breakdown)}>
          <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">ללא פירוט</SelectItem>
            <SelectItem value="fund">פירוט לפי קופה</SelectItem>
            <SelectItem value="expenseType">פירוט לפי סוג הוצאה</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {kpiA && kpiB && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label={`נטו ${labelOf(effA)}`} value={formatCurrency(kpiA.net)} tone={kpiA.net >= 0 ? "income" : "expense"} />
          <Kpi label={`נטו ${labelOf(effB)}`} value={formatCurrency(kpiB.net)} tone={kpiB.net >= 0 ? "income" : "expense"} />
          <Kpi label="שינוי נטו" value={`${pctChange(kpiA.net, kpiB.net)?.toFixed(1) ?? "—"}%`} />
        </div>
      )}

      {breakdown !== "none" && breakdownRows.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right border-l">{breakdown === "fund" ? "קופה" : "סוג הוצאה"}</TableHead>
                <TableHead className="text-left border-l">{labelOf(effA)}</TableHead>
                <TableHead className="text-left border-l">{labelOf(effB)}</TableHead>
                <TableHead className="text-left">שינוי %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdownRows.map((r) => (
                <TableRow key={r.label} className="border-b">
                  <TableCell className="font-medium border-l">{r.label}</TableCell>
                  <TableCell className="text-left tabular-nums border-l">{formatCurrency(r.a)}</TableCell>
                  <TableCell className="text-left tabular-nums border-l">{formatCurrency(r.b)}</TableCell>
                  <PctCell value={r.change} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right border-l">תקופה</TableHead>
              <TableHead className="text-left border-l">הכנסות</TableHead>
              <TableHead className="text-left border-l">הוצאות</TableHead>
              <TableHead className="text-left border-l">נטו</TableHead>
              <TableHead className="text-left">שינוי % (נטו)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key} className="border-b">
                <TableCell className="font-medium border-l">{r.label}</TableCell>
                <TableCell className="text-left tabular-nums text-income border-l">{formatCurrency(r.income)}</TableCell>
                <TableCell className="text-left tabular-nums text-expense border-l">{formatCurrency(r.expense)}</TableCell>
                <TableCell className={`text-left tabular-nums font-semibold border-l ${r.net >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(r.net)}</TableCell>
                <PctCell value={r.changeNet} />
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין נתונים</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}
