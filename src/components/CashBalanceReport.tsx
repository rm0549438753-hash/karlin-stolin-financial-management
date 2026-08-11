import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-lookups";
import { formatCurrency } from "@/lib/format";
import { Wallet, TrendingUp, TrendingDown, Printer } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { exportRowsAsPdf, objectsToTable } from "@/lib/export-pdf";
import {
import { useTransactionsRealtime } from "@/hooks/use-tx-realtime";
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList,
  ComposedChart, Line,
} from "recharts";

const PAGE_SIZE = 1000;

type CashTx = {
  id: string;
  transaction_date: string | null;
  amount: number;
};

async function fetchCashTransactions(cashAccountId: string): Promise<CashTx[]> {
  const rows: CashTx[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, transaction_date, amount")
      .eq("account_id", cashAccountId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as CashTx[];
    rows.push(...page);
    if (page.length === 0 || page.length < PAGE_SIZE) break;
    from += page.length;
  }
  return rows;
}

export function useCashBalance() {
  const { data: accounts = [] } = useAccounts();
  const cashAccount = useMemo(
    () => accounts.find((a: any) => a.schema_type === "cash"),
    [accounts],
  );
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["cash-transactions", cashAccount?.id],
    queryFn: () => fetchCashTransactions(cashAccount!.id),
    enabled: !!cashAccount?.id,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Keep in sync when transactions change
  useTransactionsRealtime("cash-balance-tx", () => {
    if (!cashAccount?.id) return;
    qc.invalidateQueries({ queryKey: ["cash-transactions", cashAccount.id] });
  });

  return { cashAccount, transactions: q.data ?? [], isLoading: q.isLoading };
}

/* ============ Compact card for the dashboard ============ */
export function CashBalanceCard() {
  const navigate = useNavigate();
  const { cashAccount, transactions } = useCashBalance();

  const { balance, monthIn, monthOut } = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let bal = 0, mi = 0, mo = 0;
    for (const t of transactions) {
      const a = Number(t.amount);
      bal += a;
      if (t.transaction_date?.startsWith(ym)) {
        if (a > 0) mi += a;
        else mo += -a;
      }
    }
    return { balance: bal, monthIn: mi, monthOut: mo };
  }, [transactions]);

  if (!cashAccount) return null;

  const monthName = new Intl.DateTimeFormat("he-IL", { month: "long" }).format(new Date());

  return (
    <Card
      className="cursor-pointer transition hover:shadow-md border-primary/30 bg-gradient-to-l from-primary/5 to-transparent"
      onClick={() => navigate({ to: "/transactions", search: { account: cashAccount.id } as any })}
    >
      <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold">יתרת מזומן בקופה</div>
            <div className={"text-3xl font-extrabold tabular-nums " + (balance >= 0 ? "text-income" : "text-expense")}>
              {formatCurrency(balance)}
            </div>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-income" />
            <span className="text-muted-foreground">נכנס {monthName}:</span>
            <span className="font-bold tabular-nums text-income">{formatCurrency(monthIn)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-expense" />
            <span className="text-muted-foreground">יצא {monthName}:</span>
            <span className="font-bold tabular-nums text-expense">{formatCurrency(monthOut)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Full report for /reports ============ */
export function CashBalanceReport() {
  const { cashAccount, transactions, isLoading } = useCashBalance();

  const yearsAvailable = useMemo(() => {
    const ys = new Set<string>();
    transactions.forEach((t) => { if (t.transaction_date) ys.add(t.transaction_date.slice(0, 4)); });
    return Array.from(ys).sort().reverse();
  }, [transactions]);
  const currentYear = String(new Date().getFullYear());
  const defaultYear = yearsAvailable.includes(currentYear) ? currentYear : (yearsAvailable[0] ?? currentYear);
  const [year, setYear] = useState<string>(defaultYear);
  useEffect(() => {
    if (yearsAvailable.length && !yearsAvailable.includes(year)) setYear(defaultYear);
  }, [yearsAvailable, defaultYear, year]);

  const totalBalance = useMemo(
    () => transactions.reduce((s, t) => s + Number(t.amount), 0),
    [transactions],
  );

  // Opening balance = sum of transactions before selected year
  const openingBalance = useMemo(() => {
    return transactions.reduce((s, t) => {
      if (!t.transaction_date) return s;
      if (t.transaction_date.slice(0, 4) < year) return s + Number(t.amount);
      return s;
    }, 0);
  }, [transactions, year]);

  const monthly = useMemo(() => {
    const monthNames = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
    const rows = monthNames.map((label, i) => ({
      key: String(i + 1).padStart(2, "0"),
      label,
      income: 0,
      expense: 0,
      net: 0,
      running: 0,
    }));
    transactions.forEach((t) => {
      if (!t.transaction_date || !t.transaction_date.startsWith(year)) return;
      const mi = Number(t.transaction_date.slice(5, 7)) - 1;
      const a = Number(t.amount);
      if (a > 0) rows[mi].income += a;
      else rows[mi].expense += -a;
    });
    let running = openingBalance;
    rows.forEach((r) => {
      r.net = r.income - r.expense;
      running += r.net;
      r.running = running;
    });
    return rows;
  }, [transactions, year, openingBalance]);

  const yearIncome = monthly.reduce((s, r) => s + r.income, 0);
  const yearExpense = monthly.reduce((s, r) => s + r.expense, 0);
  const yearNet = yearIncome - yearExpense;

  const compactFmt = (v: number) => new Intl.NumberFormat("he-IL", { notation: "compact", maximumFractionDigits: 1 }).format(v);

  const exportRows = () =>
    monthly.map((r) => ({
      "חודש": r.label,
      "נכנס": r.income || "",
      "יצא": r.expense || "",
      "תזוזה חודשית": r.net || "",
      "יתרה מצטברת": r.running,
    }));

  const onExcel = async () => {
    const XLSX = await import("xlsx");
    const rows = exportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `מזומן ${year}`);
    XLSX.writeFile(wb, `יתרת מזומן ${year}.xlsx`);
  };

  const onPdf = () => {
    const { headers, data } = objectsToTable(exportRows());
    exportRowsAsPdf(`יתרת מזומן — ${year}`, headers, data);
  };

  if (!cashAccount) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          לא הוגדר חשבון מזומן במערכת.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="print-area">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 bg-muted/40 border-b rounded-t-xl">
        <div>
          <CardTitle className="text-2xl flex items-center gap-2"><Wallet className="w-6 h-6" />יתרת מזומן</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">מבוסס על תנועות בחשבון "{cashAccount.name}"</p>
        </div>
        <div className="flex gap-2 no-print">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(yearsAvailable.length ? yearsAvailable : [currentYear]).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ExportMenu onExcel={onExcel} onPdf={onPdf} />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 ml-1" />הדפסה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען…</p>
        ) : (
          <>
            {/* Big current balance */}
            <div className="rounded-xl border bg-gradient-to-l from-primary/10 to-transparent p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground font-semibold">יתרה נוכחית בקופה</div>
                <div className={"text-5xl font-extrabold tabular-nums mt-1 " + (totalBalance >= 0 ? "text-income" : "text-expense")}>
                  {formatCurrency(totalBalance)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <div className="text-muted-foreground">הכנסות {year}</div>
                  <div className="text-xl font-bold tabular-nums text-income">{formatCurrency(yearIncome)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">הוצאות {year}</div>
                  <div className="text-xl font-bold tabular-nums text-expense">{formatCurrency(yearExpense)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">נטו {year}</div>
                  <div className={"text-xl font-bold tabular-nums " + (yearNet >= 0 ? "text-income" : "text-expense")}>{formatCurrency(yearNet)}</div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-semibold mb-3">תזוזה חודשית ויתרה מצטברת — {year}</p>
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={monthly} margin={{ top: 24, right: 10, left: 10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} orientation="left" tickFormatter={compactFmt} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="income" name="נכנס" fill="hsl(155 65% 42%)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="income" position="top" fontSize={10} formatter={(v: number) => v ? compactFmt(v) : ""} />
                  </Bar>
                  <Bar dataKey="expense" name="יצא" fill="hsl(0 70% 55%)" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="expense" position="top" fontSize={10} formatter={(v: number) => v ? compactFmt(v) : ""} />
                  </Bar>
                  <Line type="monotone" dataKey="running" name="יתרה מצטברת" stroke="hsl(220 70% 50%)" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">חודש</TableHead>
                    <TableHead className="text-left">נכנס</TableHead>
                    <TableHead className="text-left">יצא</TableHead>
                    <TableHead className="text-left">תזוזה חודשית</TableHead>
                    <TableHead className="text-left">יתרה מצטברת</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40">
                    <TableCell className="font-semibold">יתרת פתיחה ({year})</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-left font-bold tabular-nums">{formatCurrency(openingBalance)}</TableCell>
                  </TableRow>
                  {monthly.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-left tabular-nums text-income">{r.income ? formatCurrency(r.income) : "—"}</TableCell>
                      <TableCell className="text-left tabular-nums text-expense">{r.expense ? formatCurrency(r.expense) : "—"}</TableCell>
                      <TableCell className={"text-left tabular-nums font-medium " + (r.net > 0 ? "text-income" : r.net < 0 ? "text-expense" : "")}>
                        {r.net ? formatCurrency(r.net) : "—"}
                      </TableCell>
                      <TableCell className={"text-left font-bold tabular-nums " + (r.running >= 0 ? "text-income" : "text-expense")}>
                        {formatCurrency(r.running)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 border-t-2">
                    <TableCell className="font-bold">סה"כ {year}</TableCell>
                    <TableCell className="text-left font-bold tabular-nums text-income">{formatCurrency(yearIncome)}</TableCell>
                    <TableCell className="text-left font-bold tabular-nums text-expense">{formatCurrency(yearExpense)}</TableCell>
                    <TableCell className={"text-left font-bold tabular-nums " + (yearNet >= 0 ? "text-income" : "text-expense")}>{formatCurrency(yearNet)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
