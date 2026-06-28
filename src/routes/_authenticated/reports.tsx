import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccounts, useCategories, useExpenseTypes, useFunds, useSubcategories } from "@/hooks/use-lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  CalendarClock, TrendingUp, GitCompare, Trophy, PiggyBank, ListTree, AlertTriangle,
  FileText, HardHat, Download,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const PAGE_SIZE = 1000;
const TX_SELECT = "id, transaction_date, value_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit, payee";

type Tx = {
  id: string;
  transaction_date: string;
  value_date: string | null;
  amount: number;
  account_id: string;
  fund_id: string | null;
  expense_type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  description: string | null;
  note: string | null;
  credit: number | null;
  debit: number | null;
  payee: string | null;
};

async function fetchAllTransactions(): Promise<Tx[]> {
  const rows: Tx[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TX_SELECT)
      .order("transaction_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Tx[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

const PROJECT_EXPENSE_TYPE = "בית הכנסת - בניה";
const IRRELEVANT_FUND = "לא רלוונטי";

function ReportsPage() {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["reports-all-tx"],
    queryFn: fetchAllTransactions,
  });
  const { data: accounts = [] } = useAccounts();
  const { data: funds = [] } = useFunds();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();

  const lookups = { accounts, funds, expenseTypes, categories, subcategories };

  return (
    <AppShell title="דוחות">
      <Tabs defaultValue="future-checks" dir="rtl" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="future-checks" className="gap-1.5"><CalendarClock className="w-4 h-4" />צ׳קים עתידיים</TabsTrigger>
          <TabsTrigger value="cashflow" className="gap-1.5"><TrendingUp className="w-4 h-4" />תזרים חודשי</TabsTrigger>
          <TabsTrigger value="year-compare" className="gap-1.5"><GitCompare className="w-4 h-4" />השוואת שנים</TabsTrigger>
          <TabsTrigger value="top-payees" className="gap-1.5"><Trophy className="w-4 h-4" />טופ מוטבים</TabsTrigger>
          <TabsTrigger value="fund-report" className="gap-1.5"><PiggyBank className="w-4 h-4" />דוח קופה</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><ListTree className="w-4 h-4" />פילוח קטגוריות</TabsTrigger>
          <TabsTrigger value="uncategorized" className="gap-1.5"><AlertTriangle className="w-4 h-4" />לא מסווגות</TabsTrigger>
          <TabsTrigger value="annual" className="gap-1.5"><FileText className="w-4 h-4" />סיכום שנתי</TabsTrigger>
          <TabsTrigger value="project" className="gap-1.5"><HardHat className="w-4 h-4" />פרויקט בנייה</TabsTrigger>
        </TabsList>

        {isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}

        <TabsContent value="future-checks"><FutureChecksReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="cashflow"><CashflowReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="year-compare"><YearCompareReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="top-payees"><TopPayeesReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="fund-report"><FundReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="categories"><CategoryBreakdownReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="uncategorized"><UncategorizedReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="annual"><AnnualSummaryReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="project"><ProjectReport txs={txs} lookups={lookups} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ===================== Helpers ===================== */
function nameMap(arr: any[]) {
  return new Map<string, string>(arr.map((x) => [x.id, x.name]));
}

function exportRowsToExcel(rows: any[], filename: string) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "דוח");
  XLSX.writeFile(wb, filename);
}

function exportTxs(rows: Tx[], lookups: any, filename: string) {
  const acct = nameMap(lookups.accounts);
  const fund = nameMap(lookups.funds);
  const et = nameMap(lookups.expenseTypes);
  const cat = nameMap(lookups.categories);
  const sub = nameMap(lookups.subcategories);
  const data = rows.map((t) => {
    const a = Number(t.amount);
    const credit = t.credit != null ? Number(t.credit) : (a > 0 ? a : 0);
    const debit = t.debit != null ? Number(t.debit) : (a < 0 ? -a : 0);
    return {
      "תאריך": format(new Date(t.transaction_date), "dd/MM/yyyy"),
      "תאריך ערך": t.value_date ? format(new Date(t.value_date), "dd/MM/yyyy") : "",
      "חשבון": acct.get(t.account_id) ?? "",
      "פרטים": t.description ?? "",
      "מוטב": t.payee ?? "",
      "סוג": t.expense_type_id ? et.get(t.expense_type_id) ?? "" : "",
      "קטגוריה": t.category_id ? cat.get(t.category_id) ?? "" : "",
      "תת-קטגוריה": t.subcategory_id ? sub.get(t.subcategory_id) ?? "" : "",
      "קופה": t.fund_id ? fund.get(t.fund_id) ?? "" : "",
      "זכות": credit || "",
      "חובה": debit || "",
      "הערה": t.note ?? "",
    };
  });
  exportRowsToExcel(data, filename);
}

function ReportShell({ title, subtitle, onExport, children }: { title: string; subtitle?: string; onExport?: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="w-4 h-4 ml-1" />ייצוא לאקסל
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function TxRowLink({ t, lookups }: { t: Tx; lookups: any }) {
  const navigate = useNavigate();
  const acct = nameMap(lookups.accounts);
  const et = nameMap(lookups.expenseTypes);
  const cat = nameMap(lookups.categories);
  const fund = nameMap(lookups.funds);
  return (
    <TableRow
      className="cursor-pointer hover:bg-primary/5 border-b"
      onClick={() => navigate({ to: "/transactions", search: { account: t.account_id, highlight: t.id } })}
    >
      <TableCell className="whitespace-nowrap text-xs">{formatDate(t.transaction_date)}</TableCell>
      <TableCell className="text-xs whitespace-nowrap">{acct.get(t.account_id) ?? "—"}</TableCell>
      <TableCell className="text-xs">{t.description ?? "—"}</TableCell>
      <TableCell className="text-xs">{t.expense_type_id ? et.get(t.expense_type_id) : "—"}</TableCell>
      <TableCell className="text-xs">{t.category_id ? cat.get(t.category_id) : "—"}</TableCell>
      <TableCell className="text-xs">{t.fund_id ? fund.get(t.fund_id) : "—"}</TableCell>
      <TableCell className={`text-left whitespace-nowrap font-mono text-xs ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>
        {formatCurrency(Number(t.amount))}
      </TableCell>
    </TableRow>
  );
}

function TxTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="text-right">תאריך</TableHead>
        <TableHead className="text-right">חשבון</TableHead>
        <TableHead className="text-right">פרטים</TableHead>
        <TableHead className="text-right">סוג</TableHead>
        <TableHead className="text-right">קטגוריה</TableHead>
        <TableHead className="text-right">קופה</TableHead>
        <TableHead className="text-left">סכום</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/* ===================== 1. Future Checks ===================== */
function FutureChecksReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const checksAcc = useMemo(() => (lookups.accounts as any[]).find((a) => a.schema_type === "checks"), [lookups.accounts]);
  const today = new Date().toISOString().slice(0, 10);

  const future = useMemo(() => {
    if (!checksAcc) return [];
    return txs
      .filter((t) => t.account_id === checksAcc.id)
      .filter((t) => (t.value_date ?? t.transaction_date) > today)
      .sort((a, b) => (a.value_date ?? a.transaction_date).localeCompare(b.value_date ?? b.transaction_date));
  }, [txs, checksAcc, today]);

  const totalAmt = future.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const nextCheck = future[0];
  const largest = [...future].sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))[0];

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    future.forEach((t) => {
      const m = (t.value_date ?? t.transaction_date).slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + Math.abs(Number(t.amount)));
    });
    return Array.from(map.entries()).sort().map(([m, v]) => ({ month: m, סכום: v }));
  }, [future]);

  const compactFmt = (v: number) => new Intl.NumberFormat("he-IL", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  const within7Days = (d: string) => {
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  };

  if (!checksAcc) return <ReportShell title="צ׳קים עתידיים"><p className="text-muted-foreground">לא הוגדר חשבון צ׳קים.</p></ReportShell>;

  return (
    <ReportShell
      title="צ׳קים עתידיים"
      subtitle="כל צ׳ק שתאריך הערך שלו בעתיד"
      onExport={() => exportTxs(future, lookups, "צ׳קים עתידיים.xlsx")}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="סה״כ צ׳קים" value={String(future.length)} />
        <Kpi label="סכום כולל" value={formatCurrency(totalAmt)} tone="expense" />
        <Kpi label="הקרוב ביותר" value={nextCheck ? `${formatDate(nextCheck.value_date ?? nextCheck.transaction_date)}` : "—"} sub={nextCheck ? formatCurrency(Math.abs(Number(nextCheck.amount))) : ""} />
        <Kpi label="הגדול ביותר" value={largest ? formatCurrency(Math.abs(Number(largest.amount))) : "—"} sub={largest ? formatDate(largest.value_date ?? largest.transaction_date) : ""} />
      </div>

      {monthly.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-sm font-semibold mb-2">פריסה לפי חודש</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly} margin={{ top: 20, right: 10, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={11} reversed />
              <YAxis fontSize={11} orientation="right" tickFormatter={compactFmt} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="סכום" fill="hsl(35 90% 55%)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="סכום" position="top" fontSize={10} fontWeight={600} formatter={(v: number) => compactFmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך ערך</TableHead>
              <TableHead className="text-right">פרטים</TableHead>
              <TableHead className="text-right">קופה</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-left">סכום</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {future.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין צ׳קים עתידיים</TableCell></TableRow>}
            {future.map((t) => {
              const d = t.value_date ?? t.transaction_date;
              const urgent = within7Days(d);
              const fund = nameMap(lookups.funds);
              const et = nameMap(lookups.expenseTypes);
              return (
                <TableRow key={t.id} className={`border-b ${urgent ? "bg-destructive/10" : ""}`}>
                  <TableCell className="whitespace-nowrap text-xs font-semibold">{formatDate(d)} {urgent && <span className="text-destructive text-[10px]">·דחוף</span>}</TableCell>
                  <TableCell className="text-xs">{t.description ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.fund_id ? fund.get(t.fund_id) : "—"}</TableCell>
                  <TableCell className="text-xs">{t.expense_type_id ? et.get(t.expense_type_id) : "—"}</TableCell>
                  <TableCell className="text-left font-mono text-xs text-expense whitespace-nowrap">{formatCurrency(Math.abs(Number(t.amount)))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}

/* ===================== 2. Cashflow ===================== */
function CashflowReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const years = useMemo(() => Array.from(new Set(txs.map((t) => t.transaction_date.slice(0, 4)))).sort().reverse(), [txs]);
  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()));

  const months = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ m: String(i + 1).padStart(2, "0"), income: 0, expense: 0 }));
    txs.forEach((t) => {
      if (!t.transaction_date.startsWith(year)) return;
      const idx = Number(t.transaction_date.slice(5, 7)) - 1;
      const a = Number(t.amount);
      if (a > 0) arr[idx].income += a;
      else arr[idx].expense += -a;
    });
    let running = 0;
    return arr.map((r) => {
      const balance = r.income - r.expense;
      running += balance;
      return { ...r, balance, running };
    });
  }, [txs, year]);

  const totals = months.reduce((acc, r) => ({ income: acc.income + r.income, expense: acc.expense + r.expense, balance: acc.balance + r.balance }), { income: 0, expense: 0, balance: 0 });

  const data = months.map((r) => ({
    "חודש": r.m,
    "הכנסות": r.income,
    "הוצאות": r.expense,
    "מאזן חודשי": r.balance,
    "יתרה מצטברת": r.running,
  }));

  return (
    <ReportShell
      title="תזרים מזומנים חודשי"
      subtitle={`כל החשבונות · שנת ${year}`}
      onExport={() => exportRowsToExcel(data, `תזרים ${year}.xlsx`)}
    >
      <div className="flex justify-end">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">חודש</TableHead>
              <TableHead className="text-left">הכנסות</TableHead>
              <TableHead className="text-left">הוצאות</TableHead>
              <TableHead className="text-left">מאזן חודשי</TableHead>
              <TableHead className="text-left">יתרה מצטברת</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((r) => (
              <TableRow key={r.m} className="border-b">
                <TableCell className="font-semibold">{r.m}/{year}</TableCell>
                <TableCell className="text-left font-mono text-income">{formatCurrency(r.income)}</TableCell>
                <TableCell className="text-left font-mono text-expense">{formatCurrency(r.expense)}</TableCell>
                <TableCell className={`text-left font-mono font-semibold ${r.balance >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(r.balance)}</TableCell>
                <TableCell className={`text-left font-mono font-bold ${r.running >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(r.running)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted font-bold">
              <TableCell>סה״כ</TableCell>
              <TableCell className="text-left font-mono text-income">{formatCurrency(totals.income)}</TableCell>
              <TableCell className="text-left font-mono text-expense">{formatCurrency(totals.expense)}</TableCell>
              <TableCell className={`text-left font-mono ${totals.balance >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(totals.balance)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}

/* ===================== 3. Year Compare ===================== */
function YearCompareReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const years = useMemo(() => Array.from(new Set(txs.map((t) => t.transaction_date.slice(0, 4)))).sort().reverse(), [txs]);
  const [y1, setY1] = useState(years[0] ?? "");
  const [y2, setY2] = useState(years[1] ?? years[0] ?? "");

  const et = nameMap(lookups.expenseTypes);

  const rows = useMemo(() => {
    const acc = new Map<string, { name: string; y1: number; y2: number }>();
    txs.forEach((t) => {
      const yr = t.transaction_date.slice(0, 4);
      if (yr !== y1 && yr !== y2) return;
      const name = t.expense_type_id ? (et.get(t.expense_type_id) ?? "ללא סוג") : "ללא סוג";
      const e = acc.get(name) ?? { name, y1: 0, y2: 0 };
      const a = Math.abs(Number(t.amount));
      if (yr === y1) e.y1 += a; else e.y2 += a;
      acc.set(name, e);
    });
    return Array.from(acc.values())
      .map((r) => ({ ...r, diff: r.y1 - r.y2, pct: r.y2 ? ((r.y1 - r.y2) / r.y2) * 100 : 0 }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [txs, y1, y2, et]);

  return (
    <ReportShell
      title="השוואה בין שנים"
      subtitle="פילוח סכומים לפי סוג — זיהוי שינויים"
      onExport={() => exportRowsToExcel(rows.map((r) => ({ "סוג": r.name, [y1]: r.y1, [y2]: r.y2, "הפרש": r.diff, "% שינוי": r.pct.toFixed(1) })), `השוואה ${y1} vs ${y2}.xlsx`)}
    >
      <div className="flex gap-2 justify-end">
        <Select value={y1} onValueChange={setY1}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
        <span className="self-center text-sm text-muted-foreground">מול</span>
        <Select value={y2} onValueChange={setY2}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-left">{y1}</TableHead>
              <TableHead className="text-left">{y2}</TableHead>
              <TableHead className="text-left">הפרש</TableHead>
              <TableHead className="text-left">% שינוי</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name} className="border-b">
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-left font-mono">{formatCurrency(r.y1)}</TableCell>
                <TableCell className="text-left font-mono">{formatCurrency(r.y2)}</TableCell>
                <TableCell className={`text-left font-mono ${r.diff > 0 ? "text-expense" : r.diff < 0 ? "text-income" : ""}`}>{formatCurrency(r.diff)}</TableCell>
                <TableCell className={`text-left font-mono ${r.pct > 0 ? "text-expense" : r.pct < 0 ? "text-income" : ""}`}>{r.pct.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין נתונים</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}

/* ===================== 4. Top Payees ===================== */
function TopPayeesReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const [from, setFrom] = useState(yearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [limit, setLimit] = useState(20);

  const rows = useMemo(() => {
    const acc = new Map<string, { name: string; total: number; count: number }>();
    txs.forEach((t) => {
      if (t.transaction_date < from || t.transaction_date > to) return;
      if (Number(t.amount) >= 0) return;
      const name = (t.payee || t.description || "—").trim();
      if (!name) return;
      const e = acc.get(name) ?? { name, total: 0, count: 0 };
      e.total += Math.abs(Number(t.amount));
      e.count += 1;
      acc.set(name, e);
    });
    return Array.from(acc.values()).sort((a, b) => b.total - a.total).slice(0, limit);
  }, [txs, from, to, limit]);

  return (
    <ReportShell
      title="טופ מוטבים / ספקים"
      subtitle="ההוצאות הגדולות ביותר לפי שם"
      onExport={() => exportRowsToExcel(rows.map((r) => ({ "מוטב": r.name, "סה״כ": r.total, "מס׳ תנועות": r.count })), "טופ מוטבים.xlsx")}
    >
      <div className="flex flex-wrap gap-2 justify-end items-end">
        <div><Label className="text-xs">מתאריך</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" dir="ltr" /></div>
        <div><Label className="text-xs">עד</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" dir="ltr" /></div>
        <div><Label className="text-xs">כמות</Label><Input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value) || 20)} className="h-8 w-20" /></div>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">#</TableHead>
            <TableHead className="text-right">מוטב</TableHead>
            <TableHead className="text-left">סה״כ</TableHead>
            <TableHead className="text-left">תנועות</TableHead>
            <TableHead className="text-left">ממוצע</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.name} className="border-b">
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-left font-mono text-expense font-semibold">{formatCurrency(r.total)}</TableCell>
                <TableCell className="text-left font-mono">{r.count}</TableCell>
                <TableCell className="text-left font-mono">{formatCurrency(r.total / r.count)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין נתונים</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}

/* ===================== 5. Fund Report ===================== */
function FundReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const [fundId, setFundId] = useState<string>(lookups.funds[0]?.id ?? "");
  const fund = (lookups.funds as any[]).find((f) => f.id === fundId);

  const rows = useMemo(() => {
    return txs.filter((t) => t.fund_id === fundId).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  }, [txs, fundId]);

  let running = 0;
  const withRunning = rows.map((t) => {
    running += Number(t.amount);
    return { ...t, _running: running };
  });

  const credit = rows.reduce((s, t) => s + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0);
  const debit = rows.reduce((s, t) => s + (Number(t.amount) < 0 ? -Number(t.amount) : 0), 0);

  return (
    <ReportShell
      title="דוח קופה מפורט"
      subtitle={fund?.name ?? ""}
      onExport={() => exportTxs(rows, lookups, `דוח קופה - ${fund?.name ?? ""}.xlsx`)}
    >
      <div className="flex justify-between items-end gap-2 flex-wrap">
        <div className="flex gap-3 text-sm">
          <span>נכנס: <span className="text-income font-semibold">{formatCurrency(credit)}</span></span>
          <span>יצא: <span className="text-expense font-semibold">{formatCurrency(debit)}</span></span>
          <span>יתרה: <span className={`font-bold ${credit - debit >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(credit - debit)}</span></span>
        </div>
        <Select value={fundId} onValueChange={setFundId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="בחר קופה" /></SelectTrigger>
          <SelectContent>{(lookups.funds as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">תאריך</TableHead>
            <TableHead className="text-right">חשבון</TableHead>
            <TableHead className="text-right">פרטים</TableHead>
            <TableHead className="text-left">סכום</TableHead>
            <TableHead className="text-left">יתרה רצה</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {withRunning.map((t) => {
              const acct = nameMap(lookups.accounts);
              return (
                <TableRow key={t.id} className="border-b">
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(t.transaction_date)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{acct.get(t.account_id) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.description ?? "—"}</TableCell>
                  <TableCell className={`text-left font-mono text-xs ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(Number(t.amount))}</TableCell>
                  <TableCell className={`text-left font-mono text-xs font-bold ${t._running >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(t._running)}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין תנועות</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}

/* ===================== 6. Category Breakdown ===================== */
function CategoryBreakdownReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const years = useMemo(() => Array.from(new Set(txs.map((t) => t.transaction_date.slice(0, 4)))).sort().reverse(), [txs]);
  const [year, setYear] = useState(years[0] ?? "all");

  const cat = nameMap(lookups.categories);
  const sub = nameMap(lookups.subcategories);

  const rows = useMemo(() => {
    const acc = new Map<string, { cat: string; sub: string; income: number; expense: number }>();
    txs.forEach((t) => {
      if (year !== "all" && !t.transaction_date.startsWith(year)) return;
      const c = t.category_id ? (cat.get(t.category_id) ?? "ללא") : "ללא";
      const s = t.subcategory_id ? (sub.get(t.subcategory_id) ?? "—") : "—";
      const key = `${c}__${s}`;
      const e = acc.get(key) ?? { cat: c, sub: s, income: 0, expense: 0 };
      const a = Number(t.amount);
      if (a > 0) e.income += a; else e.expense += -a;
      acc.set(key, e);
    });
    return Array.from(acc.values()).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
  }, [txs, year, cat, sub]);

  const totalExp = rows.reduce((s, r) => s + r.expense, 0);

  return (
    <ReportShell
      title="פילוח קטגוריות"
      subtitle="קטגוריה × תת-קטגוריה עם אחוזים"
      onExport={() => exportRowsToExcel(rows.map((r) => ({ "קטגוריה": r.cat, "תת-קטגוריה": r.sub, "הכנסות": r.income, "הוצאות": r.expense })), `פילוח קטגוריות ${year}.xlsx`)}
    >
      <div className="flex justify-end">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל השנים</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="text-right">קטגוריה</TableHead>
            <TableHead className="text-right">תת-קטגוריה</TableHead>
            <TableHead className="text-left">הכנסות</TableHead>
            <TableHead className="text-left">הוצאות</TableHead>
            <TableHead className="text-left">% מההוצאות</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className="border-b">
                <TableCell className="text-xs font-medium">{r.cat}</TableCell>
                <TableCell className="text-xs">{r.sub}</TableCell>
                <TableCell className="text-left font-mono text-xs text-income">{r.income ? formatCurrency(r.income) : ""}</TableCell>
                <TableCell className="text-left font-mono text-xs text-expense">{r.expense ? formatCurrency(r.expense) : ""}</TableCell>
                <TableCell className="text-left font-mono text-xs">{totalExp ? ((r.expense / totalExp) * 100).toFixed(1) + "%" : ""}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין נתונים</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}

/* ===================== 7. Uncategorized ===================== */
function UncategorizedReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const rows = useMemo(() => txs.filter((t) => !t.expense_type_id && !t.fund_id), [txs]);
  const acctMap = nameMap(lookups.accounts);
  const grouped = useMemo(() => {
    const map = new Map<string, Tx[]>();
    rows.forEach((t) => {
      const k = t.account_id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return Array.from(map.entries()).map(([acc, arr]) => ({ acc, name: acctMap.get(acc) ?? "—", rows: arr }));
  }, [rows, acctMap]);

  return (
    <ReportShell
      title="תנועות לא מסווגות"
      subtitle="כל התנועות שבהן גם הסוג וגם הקופה ריקים"
      onExport={() => exportTxs(rows, lookups, "לא מסווגות.xlsx")}
    >
      <div className="text-sm font-semibold mb-2">סה״כ {rows.length} תנועות</div>
      {grouped.map((g) => (
        <div key={g.acc} className="rounded-md border overflow-x-auto mb-3">
          <div className="px-3 py-2 bg-muted text-sm font-bold flex justify-between">
            <span>{g.name}</span>
            <span>{g.rows.length} תנועות</span>
          </div>
          <Table>
            <TxTableHeader />
            <TableBody>
              {g.rows.map((t) => <TxRowLink key={t.id} t={t} lookups={lookups} />)}
            </TableBody>
          </Table>
        </div>
      ))}
      {rows.length === 0 && <p className="text-center text-muted-foreground py-8">הכל מסווג ✓</p>}
    </ReportShell>
  );
}

/* ===================== 8. Annual Summary ===================== */
function AnnualSummaryReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const years = useMemo(() => Array.from(new Set(txs.map((t) => t.transaction_date.slice(0, 4)))).sort().reverse(), [txs]);
  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()));

  const yTxs = useMemo(() => txs.filter((t) => t.transaction_date.startsWith(year)), [txs, year]);
  const income = yTxs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expense = yTxs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + -Number(t.amount), 0);

  const et = nameMap(lookups.expenseTypes);
  const byType = useMemo(() => {
    const acc = new Map<string, { name: string; v: number }>();
    yTxs.filter((t) => Number(t.amount) < 0).forEach((t) => {
      const name = t.expense_type_id ? (et.get(t.expense_type_id) ?? "ללא") : "ללא";
      const e = acc.get(name) ?? { name, v: 0 };
      e.v += Math.abs(Number(t.amount));
      acc.set(name, e);
    });
    return Array.from(acc.values()).sort((a, b) => b.v - a.v);
  }, [yTxs, et]);

  const monthly = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ m: String(i + 1).padStart(2, "0"), income: 0, expense: 0 }));
    yTxs.forEach((t) => {
      const idx = Number(t.transaction_date.slice(5, 7)) - 1;
      const a = Number(t.amount);
      if (a > 0) arr[idx].income += a; else arr[idx].expense += -a;
    });
    return arr;
  }, [yTxs]);

  return (
    <ReportShell
      title="סיכום שנתי"
      subtitle="דף אחד מסכם — מוכן להדפסה"
      onExport={() => exportRowsToExcel(byType.map((r) => ({ "סוג": r.name, "הוצאה": r.v })), `סיכום ${year}.xlsx`)}
    >
      <div className="flex justify-end">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="הכנסות" value={formatCurrency(income)} tone="income" />
        <Kpi label="הוצאות" value={formatCurrency(expense)} tone="expense" />
        <Kpi label="מאזן" value={formatCurrency(income - expense)} tone={income - expense >= 0 ? "income" : "expense"} />
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="m" reversed fontSize={11} />
          <YAxis orientation="right" fontSize={11} tickFormatter={(v) => new Intl.NumberFormat("he-IL", { notation: "compact" }).format(v)} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend />
          <Bar dataKey="income" name="הכנסות" fill="hsl(155 65% 42%)" />
          <Bar dataKey="expense" name="הוצאות" fill="hsl(0 75% 55%)" />
        </BarChart>
      </ResponsiveContainer>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead className="text-right">סוג הוצאה</TableHead><TableHead className="text-left">סכום</TableHead><TableHead className="text-left">%</TableHead></TableRow></TableHeader>
          <TableBody>
            {byType.map((r) => (
              <TableRow key={r.name} className="border-b">
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-left font-mono">{formatCurrency(r.v)}</TableCell>
                <TableCell className="text-left font-mono">{expense ? ((r.v / expense) * 100).toFixed(1) + "%" : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportShell>
  );
}

/* ===================== 9. Project (בית כנסת) ===================== */
function ProjectReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const projTypeId = (lookups.expenseTypes as any[]).find((e) => e.name === PROJECT_EXPENSE_TYPE)?.id;
  const rows = useMemo(() => {
    if (!projTypeId) return [];
    return txs.filter((t) => t.expense_type_id === projTypeId).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }, [txs, projTypeId]);

  const income = rows.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expense = rows.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + -Number(t.amount), 0);

  const cat = nameMap(lookups.categories);
  const byCat = useMemo(() => {
    const acc = new Map<string, number>();
    rows.filter((t) => Number(t.amount) < 0).forEach((t) => {
      const k = t.category_id ? (cat.get(t.category_id) ?? "ללא") : "ללא";
      acc.set(k, (acc.get(k) ?? 0) + Math.abs(Number(t.amount)));
    });
    return Array.from(acc.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows, cat]);

  return (
    <ReportShell
      title="פרויקט בית כנסת"
      subtitle="כל תנועה שסומנה בסוג ׳בית הכנסת - בניה׳"
      onExport={() => exportTxs(rows, lookups, "פרויקט בית כנסת.xlsx")}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="גיוסים" value={formatCurrency(income)} tone="income" />
        <Kpi label="ביצוע" value={formatCurrency(expense)} tone="expense" />
        <Kpi label="יתרה" value={formatCurrency(income - expense)} tone={income - expense >= 0 ? "income" : "expense"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-md border">
          <div className="px-3 py-2 bg-muted font-semibold text-sm">פילוח לפי קטגוריה</div>
          <Table>
            <TableHeader><TableRow><TableHead className="text-right">קטגוריה</TableHead><TableHead className="text-left">סכום</TableHead></TableRow></TableHeader>
            <TableBody>
              {byCat.map(([k, v]) => (
                <TableRow key={k} className="border-b"><TableCell>{k}</TableCell><TableCell className="text-left font-mono text-expense">{formatCurrency(v)}</TableCell></TableRow>
              ))}
              {byCat.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">אין נתונים</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <div className="px-3 py-2 bg-muted font-semibold text-sm">תנועות אחרונות</div>
          <Table>
            <TxTableHeader />
            <TableBody>
              {rows.slice(0, 50).map((t) => <TxRowLink key={t.id} t={t} lookups={lookups} />)}
            </TableBody>
          </Table>
        </div>
      </div>
    </ReportShell>
  );
}

/* ===================== Mini KPI ===================== */
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "income" | "expense" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${tone === "income" ? "text-income" : tone === "expense" ? "text-expense" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
