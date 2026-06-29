import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAccounts, useCategories, useExpenseTypes, useFunds, useSubcategories } from "@/hooks/use-lookups";
import { TransactionDialog, type TransactionRow } from "@/components/TransactionDialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { CalendarClock, AlertTriangle, Download, Printer, Search, Pencil } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { PrintDialog } from "@/components/PrintDialog";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) ?? "future-checks",
  }),
  component: ReportsPage,
});

const PAGE_SIZE = 1000;
const TX_SELECT = "id, transaction_date, value_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit, payee, balance, reference, fee, channel";

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
  balance: number | null;
  reference: string | null;
  fee: number | null;
  channel: string | null;
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

function ReportsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
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
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ to: "/reports", search: { tab: v } as any })}
        dir="rtl"
        className="space-y-4"
      >
        <TabsList className="flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="future-checks" className="gap-1.5 text-base font-semibold px-4 py-2">
            <CalendarClock className="w-4 h-4" />צ׳קים עתידיים
          </TabsTrigger>
          <TabsTrigger value="uncategorized" className="gap-1.5 text-base font-semibold px-4 py-2">
            <AlertTriangle className="w-4 h-4" />לא מסווגות
          </TabsTrigger>
        </TabsList>

        {isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}

        <TabsContent value="future-checks"><FutureChecksReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="uncategorized"><UncategorizedReport txs={txs} lookups={lookups} /></TabsContent>
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

function ReportShell({ title, subtitle, onExport, onPrint, children }: { title: string; subtitle?: string; onExport?: () => void; onPrint?: () => void; children: React.ReactNode }) {
  return (
    <Card className="print-area">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 bg-muted/40 border-b rounded-t-xl">
        <div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-2 no-print">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="w-4 h-4 ml-1" />ייצוא לאקסל
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onPrint ?? (() => window.print())}>
            <Printer className="w-4 h-4 ml-1" />הדפסה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">{children}</CardContent>
    </Card>
  );
}


/* ===================== Kpi ===================== */
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "income" | "expense" }) {
  const toneCls = tone === "expense" ? "text-expense" : tone === "income" ? "text-income" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold mt-1 tabular-nums ${toneCls}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* ===================== 1. Future Checks (drill: month -> day -> tx) ===================== */
function FutureChecksReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const navigate = useNavigate();
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

  const monthly = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    future.forEach((t) => {
      const m = (t.value_date ?? t.transaction_date).slice(0, 7);
      const e = map.get(m) ?? { sum: 0, count: 0 };
      e.sum += Math.abs(Number(t.amount));
      e.count += 1;
      map.set(m, e);
    });
    return Array.from(map.entries()).sort().map(([m, v]) => ({ month: m, סכום: v.sum, count: v.count }));
  }, [future]);

  const compactFmt = (v: number) => new Intl.NumberFormat("he-IL", { notation: "compact", maximumFractionDigits: 1 }).format(v);

  const [openMonth, setOpenMonth] = useState<string | null>(null);
  

  const monthLabel = openMonth
    ? new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long" }).format(new Date(openMonth + "-01"))
    : "";

  const dayBuckets = useMemo(() => {
    if (!openMonth) return [] as { date: string; rows: Tx[]; sum: number }[];
    const map = new Map<string, Tx[]>();
    future.forEach((t) => {
      const d = (t.value_date ?? t.transaction_date);
      if (!d.startsWith(openMonth)) return;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    });
    return Array.from(map.entries())
      .sort()
      .map(([date, rows]) => ({ date, rows, sum: rows.reduce((s, r) => s + Math.abs(Number(r.amount)), 0) }));
  }, [openMonth, future]);


  if (!checksAcc) return <ReportShell title="צ׳קים עתידיים"><p className="text-muted-foreground">לא הוגדר חשבון צ׳קים.</p></ReportShell>;

  return (
    <ReportShell
      title="צ׳קים עתידיים"
      onExport={() => exportTxs(future, lookups, "צ׳קים עתידיים.xlsx")}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="סה״כ צ׳קים עתידיים" value={String(future.length)} />
        <Kpi label="סכום כולל" value={formatCurrency(totalAmt)} tone="expense" />
        <Kpi
          label="הקרוב ביותר"
          value={nextCheck ? formatDate(nextCheck.value_date ?? nextCheck.transaction_date) : "—"}
          sub={nextCheck ? formatCurrency(Math.abs(Number(nextCheck.amount))) : ""}
        />
      </div>

      {monthly.length > 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold mb-3">פריסה לפי חודש — לחץ לפירוט</p>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthly} margin={{ top: 24, right: 10, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} reversed />
              <YAxis fontSize={12} orientation="right" tickFormatter={compactFmt} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar
                dataKey="סכום"
                fill="hsl(35 90% 55%)"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(d: any) => setOpenMonth(d.month)}
              >
                <LabelList dataKey="סכום" position="top" fontSize={11} fontWeight={700} formatter={(v: number) => compactFmt(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">אין צ׳קים עתידיים</p>
      )}

      {/* Month sheet — accordion of days */}
      <Sheet open={!!openMonth} onOpenChange={(o) => { if (!o) setOpenMonth(null); }}>
        <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader className="border-b pb-3 mb-4">
            <SheetTitle className="text-2xl">{monthLabel}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {dayBuckets.length} ימים · סה״כ{" "}
              <b className="text-expense">{formatCurrency(dayBuckets.reduce((s, d) => s + d.sum, 0))}</b>
            </p>
          </SheetHeader>

          <Accordion type="multiple" className="space-y-2">
            {dayBuckets.map((d) => (
              <AccordionItem key={d.date} value={d.date} className="rounded-xl border bg-card overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:bg-muted/40 hover:no-underline data-[state=open]:bg-muted/50">
                  <div className="flex items-center justify-between w-full gap-4 pl-2">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold tabular-nums">{formatDate(d.date)}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{d.rows.length} צ׳קים</span>
                    </div>
                    <span className="text-base font-bold text-expense tabular-nums">{formatCurrency(d.sum)}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0 border-t bg-background">
                  <Table className="border-collapse">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-right text-xs font-bold text-muted-foreground border-l border-border last:border-l-0 px-3 py-2">פרטים</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground border-l border-border last:border-l-0 px-3 py-2">מוטב</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground border-l border-border last:border-l-0 px-3 py-2">סוג</TableHead>
                        <TableHead className="text-right text-xs font-bold text-muted-foreground border-l border-border last:border-l-0 px-3 py-2">קופה</TableHead>
                        <TableHead className="text-left text-xs font-bold text-muted-foreground border-l border-border last:border-l-0 px-3 py-2">סכום</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.rows.map((t, idx) => {
                        const fund = nameMap(lookups.funds);
                        const et = nameMap(lookups.expenseTypes);
                        return (
                          <TableRow
                            key={t.id}
                            className={"cursor-pointer hover:bg-primary/5 border-b border-border " + (idx % 2 ? "bg-muted/20" : "")}
                            onClick={() => {
                              setOpenMonth(null);
                              navigate({ to: "/transactions", search: { account: t.account_id, highlight: t.id } });
                            }}
                          >
                            <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{t.description ?? "—"}</TableCell>
                            <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{t.payee ?? "—"}</TableCell>
                            <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{t.expense_type_id ? et.get(t.expense_type_id) : "—"}</TableCell>
                            <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{t.fund_id ? fund.get(t.fund_id) : "—"}</TableCell>
                            <TableCell className="text-left font-mono text-expense tabular-nums border-l border-border/60 last:border-l-0 px-3 py-2 text-sm font-semibold">{formatCurrency(Math.abs(Number(t.amount)))}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SheetContent>
      </Sheet>
    </ReportShell>

  );
}




/* ===================== 3. Uncategorized (with filters + edit) ===================== */
function UncategorizedReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const allUnc = useMemo(() => txs.filter((t) => !t.expense_type_id && !t.fund_id), [txs]);
  const acctMap = nameMap(lookups.accounts);
  const catMap = nameMap(lookups.categories);
  const subMap = nameMap(lookups.subcategories);

  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [printOpen, setPrintOpen] = useState(false);

  const accountsWithUnc = useMemo(() => {
    const counts = new Map<string, number>();
    allUnc.forEach((t) => counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1));
    return (lookups.accounts as any[])
      .filter((a) => counts.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, count: counts.get(a.id) ?? 0 }));
  }, [allUnc, lookups.accounts]);

  const filtered = useMemo(() => {
    const byAccount = accountFilter === "all" ? allUnc : allUnc.filter((t) => t.account_id === accountFilter);
    const q = search.trim().toLowerCase();
    const searched = q
      ? byAccount.filter((t) => [
        t.description,
        t.reference,
        t.note,
        t.payee,
        acctMap.get(t.account_id),
        t.category_id ? catMap.get(t.category_id) : "",
        t.subcategory_id ? subMap.get(t.subcategory_id) : "",
        t.transaction_date,
        formatDate(t.transaction_date),
        String(t.amount),
        formatCurrency(Number(t.amount)),
      ].some((v) => String(v ?? "").toLowerCase().includes(q)))
      : byAccount;
    return [...searched].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  }, [allUnc, accountFilter, search, acctMap, catMap, subMap]);

  const editingAccount = editing ? (lookups.accounts as any[]).find((a) => a.id === editing.account_id) : null;

  const totalAmt = useMemo(() => filtered.reduce((s, t) => s + Math.abs(Number(t.amount)), 0), [filtered]);
  const accountsCount = accountsWithUnc.length;
  const oldestDate = useMemo(() => {
    if (filtered.length === 0) return null;
    return filtered.reduce((min, t) => (t.transaction_date < min ? t.transaction_date : min), filtered[0].transaction_date);
  }, [filtered]);

  return (
    <ReportShell
      title="תנועות לא מסווגות"
      onExport={() => exportTxs(filtered, lookups, "לא מסווגות.xlsx")}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="סה״כ לא מסווגות" value={String(filtered.length)} />
        <Kpi label="סכום מצטבר" value={formatCurrency(totalAmt)} tone="expense" />
        <Kpi label="חשבונות" value={String(accountsCount)} />
        <Kpi label="הוותיק ביותר" value={oldestDate ? formatDate(oldestDate) : "—"} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש בתיאור / אסמכתה / הערה / שם"
              className="pr-9 bg-card"
            />
          </div>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-72 h-9"><SelectValue placeholder="כל החשבונות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל החשבונות ({allUnc.length})</SelectItem>
              {accountsWithUnc.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name} ({a.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setAccountFilter("all"); }}>איפוס</Button>
        </div>

        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">תאריך</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">חשבון</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">פרטים</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">מוטב</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">סוג</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">קופה</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">קטגוריה</TableHead>
                <TableHead className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">סכום</TableHead>
                <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-2 whitespace-nowrap">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">הכל מסווג ✓</TableCell></TableRow>
              )}
              {filtered.map((t, idx) => (
                <TableRow
                  key={t.id}
                  className={"group cursor-pointer border-b border-border transition-colors hover:bg-primary/5 " + (idx % 2 ? "bg-muted/20 " : "")}
                  onClick={() => setEditing(t as unknown as TransactionRow)}
                >
                  <TableCell className="whitespace-nowrap tabular-nums border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle">{formatDate(t.transaction_date)}</TableCell>
                  <TableCell className="whitespace-nowrap border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle">{acctMap.get(t.account_id) ?? "—"}</TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle max-w-[280px] truncate">{t.description ?? "—"}</TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle max-w-[180px] truncate">{t.payee ?? "—"}</TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle"><UncatBadge /></TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle"><UncatBadge /></TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle">{t.category_id ? catMap.get(t.category_id) ?? "—" : "—"}</TableCell>
                  <TableCell className={`text-left font-mono tabular-nums border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs font-semibold align-middle ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>
                    {formatCurrency(Number(t.amount))}
                  </TableCell>
                  <TableCell className="text-center px-2 py-1.5 align-middle">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); setEditing(t as unknown as TransactionRow); }}>
                      <Pencil className="w-3.5 h-3.5 ml-1" />עריכה
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/30 text-sm text-muted-foreground">
          <span>סה״כ {filtered.length} תנועות · {accountsCount} חשבונות · הוותיק ביותר: {oldestDate ? formatDate(oldestDate) : "—"}</span>
          <span className="font-semibold text-expense tabular-nums">{formatCurrency(totalAmt)}</span>
        </div>
      </div>


      <TransactionDialog
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        initial={editing}
        account={editingAccount}
        lockAccount
      />
    </ReportShell>
  );
}

function UncatBadge() {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-dashed border-amber-300">לא מסווג</span>;
}
