import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { ReportShell, Kpi, exportRowsToExcel, type Tx } from "@/routes/_authenticated/reports";
import { exportRowsAsPdf, objectsToTable } from "@/lib/export-pdf";

function normalizeKey(t: Tx) {
  const raw = (t.payee?.trim() || t.description?.trim() || "").toLowerCase();
  return raw.replace(/\s+/g, " ").trim();
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ForecastReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const checksAcc = useMemo(() => (lookups.accounts as any[]).find((a) => a.schema_type === "checks"), [lookups.accounts]);

  // Next 6 calendar months, starting with the current month.
  const forecastMonths = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      arr.push(monthKey(d));
    }
    return arr;
  }, []);

  // Known future-dated transactions (checks use value_date; others use transaction_date).
  const futureTxs = useMemo(() => {
    return txs.filter((t) => {
      const d = checksAcc && t.account_id === checksAcc.id ? (t.value_date ?? t.transaction_date) : t.transaction_date;
      return d > todayStr;
    });
  }, [txs, checksAcc, todayStr]);

  // Recurring expenses: payee/description appearing in >=3 of the last 6 months with similar amounts.
  const recurring = useMemo(() => {
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const groups = new Map<string, { months: Set<string>; amounts: number[] }>();
    txs.forEach((t) => {
      const a = Number(t.amount);
      if (a >= 0) return; // expenses only
      const d = new Date(t.transaction_date);
      if (d < sixMonthsAgo || d >= new Date(today.getFullYear(), today.getMonth(), 1)) return;
      const key = normalizeKey(t);
      if (!key) return;
      const e = groups.get(key) ?? { months: new Set<string>(), amounts: [] };
      e.months.add(t.transaction_date.slice(0, 7));
      e.amounts.push(-a);
      groups.set(key, e);
    });
    const result: { key: string; monthlyAvg: number; monthsSeen: number }[] = [];
    groups.forEach((v, key) => {
      if (v.months.size < 3) return;
      const mean = v.amounts.reduce((s, x) => s + x, 0) / v.amounts.length;
      const variance = v.amounts.reduce((s, x) => s + (x - mean) ** 2, 0) / v.amounts.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      if (cv > 0.5) return; // amounts not "similar" enough
      result.push({ key, monthlyAvg: mean, monthsSeen: v.months.size });
    });
    return result;
  }, [txs]);

  const recurringMonthlyTotal = useMemo(() => recurring.reduce((s, r) => s + r.monthlyAvg, 0), [recurring]);

  const openingBalance = useMemo(() => txs.reduce((s, t) => s + Number(t.amount), 0), [txs]);

  const monthly = useMemo(() => {
    let running = openingBalance;
    return forecastMonths.map((m, i) => {
      const known = futureTxs.filter((t) => {
        const d = checksAcc && t.account_id === checksAcc.id ? (t.value_date ?? t.transaction_date) : t.transaction_date;
        return d.slice(0, 7) === m;
      });
      const inflow = known.reduce((s, t) => (Number(t.amount) > 0 ? s + Number(t.amount) : s), 0);
      let outflow = known.reduce((s, t) => (Number(t.amount) < 0 ? s + -Number(t.amount) : s), 0);
      // Add projected recurring expenses (estimate — does not attempt to de-duplicate against known future rows).
      outflow += recurringMonthlyTotal;
      running += inflow - outflow;
      return {
        month: m,
        label: new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long" }).format(new Date(m + "-01")),
        inflow,
        outflow,
        net: inflow - outflow,
        running,
      };
    });
  }, [forecastMonths, futureTxs, checksAcc, recurringMonthlyTotal, openingBalance]);

  const totalInflow = monthly.reduce((s, m) => s + m.inflow, 0);
  const totalOutflow = monthly.reduce((s, m) => s + m.outflow, 0);
  const finalBalance = monthly.length ? monthly[monthly.length - 1].running : openingBalance;

  const exportRows = () => monthly.map((m) => ({
    "חודש": m.label,
    "צפי הכנסות": m.inflow,
    "צפי הוצאות": m.outflow,
    "נטו": m.net,
    "יתרה חזויה": m.running,
  }));

  return (
    <ReportShell
      title="תזרים חזוי"
      subtitle="תחזית 6 חודשים קדימה — בהתבסס על צ׳קים/תנועות עתידיות ידועות + הוצאות חוזרות שזוהו אוטומטית"
      onExport={() => exportRowsToExcel(exportRows(), "תזרים חזוי.xlsx")}
      onExportPdf={() => {
        const { headers, data } = objectsToTable(exportRows());
        exportRowsAsPdf("תזרים חזוי", headers, data);
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="יתרת פתיחה (נוכחית)" value={formatCurrency(openingBalance)} tone={openingBalance >= 0 ? "income" : "expense"} />
        <Kpi label="סה״כ צפי הכנסות (6ח׳)" value={formatCurrency(totalInflow)} tone="income" />
        <Kpi label="סה״כ צפי הוצאות (6ח׳)" value={formatCurrency(totalOutflow)} tone="expense" />
        <Kpi label="יתרה חזויה בעוד 6 חודשים" value={formatCurrency(finalBalance)} tone={finalBalance >= 0 ? "income" : "expense"} />
      </div>

      <p className="text-sm text-muted-foreground">
        זוהו {recurring.length} הוצאות חוזרות (מוטב/תיאור שהופיע ב-3 חודשים לפחות מתוך 6 החודשים האחרונים בסכום דומה), בסך חודשי משוער של {formatCurrency(recurringMonthlyTotal)}.
      </p>

      <div className="rounded-lg border overflow-hidden">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-right border-l">חודש</TableHead>
              <TableHead className="text-left border-l">צפי הכנסות</TableHead>
              <TableHead className="text-left border-l">צפי הוצאות</TableHead>
              <TableHead className="text-left border-l">נטו</TableHead>
              <TableHead className="text-left">יתרה חזויה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthly.map((m) => (
              <TableRow key={m.month} className="border-b">
                <TableCell className="font-medium border-l">{m.label}</TableCell>
                <TableCell className="text-left tabular-nums text-income border-l">{formatCurrency(m.inflow)}</TableCell>
                <TableCell className="text-left tabular-nums text-expense border-l">{formatCurrency(m.outflow)}</TableCell>
                <TableCell className={`text-left tabular-nums font-medium border-l ${m.net >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(m.net)}</TableCell>
                <TableCell className={`text-left font-bold tabular-nums ${m.running >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(m.running)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}
