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
import { CalendarClock, AlertTriangle, Download, Printer, Search, Pencil, X, Trash2, CalendarX, Save } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { PrintDialog } from "@/components/PrintDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkEditDialog } from "@/components/BulkEditDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ExportMenu";
import { exportRowsAsPdf, objectsToTable } from "@/lib/export-pdf";
import { useUserRole } from "@/hooks/use-auth";

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
const TX_SELECT = "id, transaction_date, value_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit, payee, balance, reference, fee, channel, association";

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
  association: string | null;
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
        onValueChange={(v) => navigate({ to: "/reports", search: { tab: v } as any, replace: true })}
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
          <TabsTrigger value="no-date" className="gap-1.5 text-base font-semibold px-4 py-2">
            <CalendarX className="w-4 h-4" />ללא תאריך
          </TabsTrigger>
        </TabsList>

        {isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}

        <TabsContent value="future-checks"><FutureChecksReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="uncategorized"><UncategorizedReport txs={txs} lookups={lookups} /></TabsContent>
        <TabsContent value="no-date"><NoDateReport txs={txs} lookups={lookups} /></TabsContent>

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

function buildTxRows(rows: Tx[], lookups: any) {
  const acct = nameMap(lookups.accounts);
  const fund = nameMap(lookups.funds);
  const et = nameMap(lookups.expenseTypes);
  const cat = nameMap(lookups.categories);
  const sub = nameMap(lookups.subcategories);
  return rows.map((t) => {
    const a = Number(t.amount);
    const credit = t.credit != null ? Number(t.credit) : (a > 0 ? a : 0);
    const debit = t.debit != null ? Number(t.debit) : (a < 0 ? -a : 0);
    return {
      "תאריך": format(new Date(t.transaction_date), "dd/MM/yyyy"),
      "תאריך ערך": t.value_date ? format(new Date(t.value_date), "dd/MM/yyyy") : "",
      "חשבון": acct.get(t.account_id) ?? "",
      "פרטים": (t.description ?? t.payee ?? ""),
      "מוטב": t.payee ?? "",
      "עמותה": t.association ?? "",
      "סוג": t.expense_type_id ? et.get(t.expense_type_id) ?? "" : "",
      "קטגוריה": t.category_id ? cat.get(t.category_id) ?? "" : "",
      "תת-קטגוריה": t.subcategory_id ? sub.get(t.subcategory_id) ?? "" : "",
      "קופה": t.fund_id ? fund.get(t.fund_id) ?? "" : "",
      "זכות": credit || "",
      "חובה": debit || "",
      "הערה": t.note ?? "",
    };
  });
}

function exportTxs(rows: Tx[], lookups: any, filename: string) {
  exportRowsToExcel(buildTxRows(rows, lookups), filename);
}

function exportTxsPdf(rows: Tx[], lookups: any, title: string) {
  const data = buildTxRows(rows, lookups);
  const { headers, data: matrix } = objectsToTable(data);
  exportRowsAsPdf(title, headers, matrix);
}

function ReportShell({ title, subtitle, onExport, onExportPdf, onPrint, children }: { title: string; subtitle?: string; onExport?: () => void; onExportPdf?: () => void; onPrint?: () => void; children: React.ReactNode }) {
  return (
    <Card className="print-area">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 bg-muted/40 border-b rounded-t-xl">
        <div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-2 no-print">
          {onExport && (
            <ExportMenu onExcel={onExport} onPdf={onPrint ?? onExportPdf ?? (() => window.print())} />
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
  const [printOpen, setPrintOpen] = useState(false);
  const acctMap = nameMap(lookups.accounts);
  

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
      onExportPdf={() => exportTxsPdf(future, lookups, "צ׳קים עתידיים")}
      onPrint={() => setPrintOpen(true)}
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
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} orientation="left" tickFormatter={compactFmt} />
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-2xl">{monthLabel}</SheetTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {dayBuckets.length} ימים · סה״כ{" "}
                  <b className="text-expense">{formatCurrency(dayBuckets.reduce((s, d) => s + d.sum, 0))}</b>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <ExportMenu
                  onExcel={() => {
                    const monthRows = future.filter((t) => (t.value_date ?? t.transaction_date).startsWith(openMonth ?? ""));
                    exportTxs(monthRows, lookups, `צ׳קים עתידיים - ${monthLabel}.xlsx`);
                  }}
                  onPdf={() => setPrintOpen(true)}
                />
                <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)}>
                  <Printer className="w-4 h-4 ml-1" />הדפסה
                </Button>
              </div>
            </div>
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
                  {(() => {
                    // Group day's rows by association
                    const groups = new Map<string, Tx[]>();
                    d.rows.forEach((t) => {
                      const key = (t as any).association?.trim() || "ללא עמותה";
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(t);
                    });
                    const groupArr = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "he"));
                    const fund = nameMap(lookups.funds);
                    const et = nameMap(lookups.expenseTypes);
                    return (
                      <div className="divide-y">
                        {groupArr.map(([assoc, rows]) => {
                          const groupSum = rows.reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
                          return (
                            <div key={assoc}>
                              <div className="flex items-center justify-between bg-primary/5 px-4 py-2 text-sm">
                                <span className="font-semibold text-primary">{assoc}</span>
                                <span className="text-xs text-muted-foreground">
                                  {rows.length} צ׳קים · <b className="text-expense">{formatCurrency(groupSum)}</b>
                                </span>
                              </div>
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
                                  {rows.map((t, idx) => (
                                    <TableRow
                                      key={t.id}
                                      className={"cursor-pointer hover:bg-primary/5 border-b border-border " + (idx % 2 ? "bg-muted/20" : "")}
                                      onClick={() => {
                                        setOpenMonth(null);
                                        navigate({ to: "/transactions", search: { account: t.account_id, highlight: t.id } });
                                      }}
                                    >
                                      <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{(t.description ?? t.payee ?? "—")}</TableCell>
                                      <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{t.payee ?? "—"}</TableCell>
                                      <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{t.expense_type_id ? et.get(t.expense_type_id) : "—"}</TableCell>
                                      <TableCell className="border-l border-border/60 last:border-l-0 px-3 py-2 text-sm">{t.fund_id ? fund.get(t.fund_id) : "—"}</TableCell>
                                      <TableCell className="text-left font-mono text-expense tabular-nums border-l border-border/60 last:border-l-0 px-3 py-2 text-sm font-semibold">{formatCurrency(Math.abs(Number(t.amount)))}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SheetContent>
      </Sheet>

      <PrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="דוח צ׳קים עתידיים"
        subtitle={checksAcc ? `חשבון: ${checksAcc.name}` : undefined}
        scopes={[
          ...(openMonth ? [{ id: "month", label: `רק החודש הפתוח (${monthLabel})`, rows: future.filter((t) => (t.value_date ?? t.transaction_date).startsWith(openMonth)) }] : []),
          { id: "all", label: "כל הצ׳קים העתידיים", rows: future },
          ...Array.from(new Set(future.map((t) => (t.association ?? "").trim()).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, "he"))
            .map((assoc) => ({
              id: `assoc-${assoc}`,
              label: `עמותה: ${assoc}`,
              rows: future.filter((t) => (t.association ?? "").trim() === assoc),
            })),
          ...(future.some((t) => !(t.association ?? "").trim())
            ? [{ id: "assoc-none", label: "ללא עמותה", rows: future.filter((t) => !(t.association ?? "").trim()) }]
            : []),
        ]}
        columns={[
          { id: "vdate", header: "תאריך ערך", format: (t) => formatDate(t.value_date ?? t.transaction_date) },
          { id: "tdate", header: "תאריך תנועה", format: (t) => formatDate(t.transaction_date) },
          { id: "payee", header: "שם", format: (t) => t.payee ?? "" },
          { id: "assoc", header: "עמותה", format: (t) => t.association ?? "" },
          { id: "desc", header: "פרטים", format: (t) => (t.description ?? t.payee ?? "") },
          { id: "ref", header: "אסמכתה", format: (t) => t.reference ?? "" },
          { id: "note", header: "הערה", format: (t) => t.note ?? "" },
          { id: "account", header: "חשבון", format: (t) => acctMap.get(t.account_id) ?? "" },
          { id: "amount", header: "סכום", align: "left", format: (t) => formatCurrency(Math.abs(Number(t.amount))) },
        ]}
        totals={[
          { label: "סך צ׳קים", value: future.length.toLocaleString("he-IL") },
          { label: "סכום כולל", value: formatCurrency(totalAmt), tone: "expense" },
        ]}
      />
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const { data: role } = useUserRole();
  const qc = useQueryClient();

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error } = await supabase.from("transactions").delete().in("id", chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} תנועות נמחקו`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["reports-all-tx"] });
      qc.invalidateQueries({ queryKey: ["tx-dashboard-full"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });


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

  const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && filteredIds.some((id) => selectedIds.has(id));
  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) filteredIds.forEach((id) => next.delete(id));
    else filteredIds.forEach((id) => next.add(id));
    setSelectedIds(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  return (
    <ReportShell
      title="תנועות לא מסווגות"
      onExport={() => exportTxs(filtered, lookups, "לא מסווגות.xlsx")}
      onExportPdf={() => exportTxsPdf(filtered, lookups, "לא מסווגות")}
      onPrint={() => setPrintOpen(true)}
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

        {selectedIds.size > 0 && (
          <div className="px-4 py-2.5 bg-primary/10 border-y border-primary/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Checkbox checked={true} onCheckedChange={() => setSelectedIds(new Set())} />
              נבחרו {selectedIds.size} תנועות
            </div>
            <div className="flex gap-2">
              {role?.isEditor && (
                <Button size="sm" variant="default" onClick={() => setBulkEditOpen(true)}>
                  <Pencil className="w-3.5 h-3.5 ml-1" />שינוי נבחרות
                </Button>
              )}
              {role?.isAdmin && (
                <Button size="sm" variant="outline" className="text-destructive border-destructive/40" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="w-3.5 h-3.5 ml-1" />מחיקה
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X className="w-3.5 h-3.5 ml-1" />בטל בחירה
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-8 px-1 border-l border-border text-center">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="בחר הכל"
                    title="בחר הכל"
                  />
                </TableHead>
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
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">הכל מסווג ✓</TableCell></TableRow>
              )}
              {filtered.map((t, idx) => {
                const isChecked = selectedIds.has(t.id);
                return (
                <TableRow
                  key={t.id}
                  className={"group border-b border-border transition-colors hover:bg-primary/5 " + (role?.isEditor ? "cursor-pointer " : "") + (isChecked ? "bg-primary/5 " : idx % 2 ? "bg-muted/20 " : "")}
                  onClick={role?.isEditor ? () => setEditing(t as unknown as TransactionRow) : undefined}
                >
                  <TableCell className="w-8 px-1 text-center border-l border-border/60" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleOne(t.id)} aria-label="בחר תנועה" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle">{formatDate(t.transaction_date)}</TableCell>
                  <TableCell className="whitespace-nowrap border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle">{acctMap.get(t.account_id) ?? "—"}</TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle max-w-[280px] truncate">{(t.description ?? t.payee ?? "—")}</TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle max-w-[180px] truncate">{t.payee ?? "—"}</TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle"><UncatBadge /></TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle"><UncatBadge /></TableCell>
                  <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs align-middle">{t.category_id ? catMap.get(t.category_id) ?? "—" : "—"}</TableCell>
                  <TableCell className={`text-left font-mono tabular-nums border-l border-border/60 last:border-l-0 px-2 py-1.5 text-xs font-semibold align-middle ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>
                    {formatCurrency(Number(t.amount))}
                  </TableCell>
                  <TableCell className="text-center px-2 py-1.5 align-middle">
                    {role?.isEditor && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); setEditing(t as unknown as TransactionRow); }}>
                        <Pencil className="w-3.5 h-3.5 ml-1" />עריכה
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })}
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

      <PrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        title="דוח תנועות לא מסווגות"
        subtitle={accountFilter === "all" ? "כל החשבונות" : `חשבון: ${acctMap.get(accountFilter) ?? ""}`}
        scopes={[
          { id: "filtered", label: "כל התנועות הלא מסווגות בתצוגה הנוכחית", rows: filtered },
          { id: "all", label: "כל התנועות הלא מסווגות (ללא סינון)", rows: allUnc },
        ]}
        columns={[
          { id: "date", header: "תאריך", format: (t) => formatDate(t.transaction_date) },
          { id: "account", header: "חשבון", format: (t) => acctMap.get(t.account_id) ?? "" },
          { id: "desc", header: "פרטים", format: (t) => (t.description ?? t.payee ?? "") },
          { id: "payee", header: "מוטב", format: (t) => t.payee ?? "" },
          { id: "ref", header: "אסמכתה", format: (t) => t.reference ?? "" },
          { id: "note", header: "הערה", format: (t) => t.note ?? "" },
          { id: "cat", header: "קטגוריה", format: (t) => (t.category_id ? catMap.get(t.category_id) ?? "" : "") },
          { id: "sub", header: "תת קטגוריה", format: (t) => (t.subcategory_id ? subMap.get(t.subcategory_id) ?? "" : "") },
          { id: "amount", header: "סכום", align: "left", format: (t) => formatCurrency(Number(t.amount)) },
        ]}
        totals={[
          { label: "סך תנועות", value: filtered.length.toLocaleString("he-IL") },
          { label: "סכום מצטבר", value: formatCurrency(totalAmt), tone: "expense" },
          { label: "חשבונות", value: String(accountsCount) },
        ]}
      />

      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        ids={Array.from(selectedIds)}
        onDone={() => { setSelectedIds(new Set()); qc.invalidateQueries({ queryKey: ["reports-all-tx"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); }}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת {selectedIds.size} תנועות?</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => bulkDel.mutate(Array.from(selectedIds))}>מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReportShell>
  );
}

function UncatBadge() {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-dashed border-amber-300">לא מסווג</span>;
}

/* ===================== 4. No Date (inline date editor) ===================== */
function NoDateReport({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const acctMap = nameMap(lookups.accounts);
  const fundMap = nameMap(lookups.funds);
  const etMap = nameMap(lookups.expenseTypes);
  const qc = useQueryClient();
  const { data: role } = useUserRole();

  const checksAccountIds = useMemo(
    () => new Set(((lookups.accounts as any[]) ?? []).filter((a) => a.schema_type === "checks").map((a) => a.id)),
    [lookups.accounts],
  );
  const noDateTxs = useMemo(
    // Checks account: dateless only when value_date is missing.
    // Other accounts: dateless when both transaction_date and value_date are missing.
    () => txs.filter((t) => checksAccountIds.has(t.account_id) ? !t.value_date : (!t.transaction_date && !t.value_date)),
    [txs, checksAccountIds],
  );

  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const accountsWithRows = useMemo(() => {
    const counts = new Map<string, number>();
    noDateTxs.forEach((t) => counts.set(t.account_id, (counts.get(t.account_id) ?? 0) + 1));
    return (lookups.accounts as any[])
      .filter((a) => counts.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, count: counts.get(a.id) ?? 0 }));
  }, [noDateTxs, lookups.accounts]);

  const filtered = useMemo(() => {
    const byAcc = accountFilter === "all" ? noDateTxs : noDateTxs.filter((t) => t.account_id === accountFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byAcc;
    return byAcc.filter((t) =>
      [t.description, t.payee, t.note, t.reference, acctMap.get(t.account_id), String(t.amount)]
        .some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [noDateTxs, accountFilter, search, acctMap]);

  const totalAmt = useMemo(() => filtered.reduce((s, t) => s + Math.abs(Number(t.amount)), 0), [filtered]);

  const updateDate = useMutation({
    mutationFn: async ({ id, date, isChecks }: { id: string; date: string; isChecks: boolean }) => {
      // For checks account the effective date is value_date; update it there.
      const patch = isChecks ? { value_date: date } : { transaction_date: date };
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("תאריך עודכן");
      setDrafts((d) => { const n = { ...d }; delete n[vars.id]; return n; });
      qc.invalidateQueries({ queryKey: ["reports-all-tx"] });
      qc.invalidateQueries({ queryKey: ["tx-dashboard-full"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["alerts-no-date-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
    onSettled: () => setSavingId(null),
  });

  return (
    <ReportShell
      title="תנועות ללא תאריך"
      subtitle="תנועות אלו לא נכללות בחישובי הגרפים והעוגות בלוח הבקרה"
      onExport={() => exportTxs(filtered as any, lookups, "ללא תאריך.xlsx")}
      onExportPdf={() => exportTxsPdf(filtered as any, lookups, "ללא תאריך")}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Kpi label="סה״כ ללא תאריך" value={String(filtered.length)} />
        <Kpi label="סכום מצטבר" value={formatCurrency(totalAmt)} tone="expense" />
        <Kpi label="חשבונות" value={String(accountsWithRows.length)} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש בתיאור / מוטב / הערה"
              className="pr-9 bg-card"
            />
          </div>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-72 h-9"><SelectValue placeholder="כל החשבונות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל החשבונות ({noDateTxs.length})</SelectItem>
              {accountsWithRows.map((a) => (
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
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">תאריך חדש</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">חשבון</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">פרטים</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">מוטב</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">סוג</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">קופה</TableHead>
                <TableHead className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-2 py-2 whitespace-nowrap">סכום</TableHead>
                <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-2 whitespace-nowrap">שמירה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">אין תנועות ללא תאריך ✓</TableCell></TableRow>
              )}
              {filtered.map((t, idx) => {
                const draft = drafts[t.id] ?? "";
                const isSaving = savingId === t.id;
                return (
                  <TableRow key={t.id} className={"border-b border-border " + (idx % 2 ? "bg-muted/20" : "")}>
                    <TableCell className="border-l border-border/60 px-2 py-1.5 align-middle">
                      <Input
                        type="date"
                        value={draft}
                        onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                        className="h-8 w-40 text-xs"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap border-l border-border/60 px-2 py-1.5 text-xs align-middle">{acctMap.get(t.account_id) ?? "—"}</TableCell>
                    <TableCell className="border-l border-border/60 px-2 py-1.5 text-xs align-middle max-w-[260px] truncate">{(t.description ?? t.payee ?? "—")}</TableCell>
                    <TableCell className="border-l border-border/60 px-2 py-1.5 text-xs align-middle max-w-[160px] truncate">{t.payee ?? "—"}</TableCell>
                    <TableCell className="border-l border-border/60 px-2 py-1.5 text-xs align-middle">{t.expense_type_id ? etMap.get(t.expense_type_id) ?? "—" : "—"}</TableCell>
                    <TableCell className="border-l border-border/60 px-2 py-1.5 text-xs align-middle">{t.fund_id ? fundMap.get(t.fund_id) ?? "—" : "—"}</TableCell>
                    <TableCell className={`text-left font-mono tabular-nums border-l border-border/60 px-2 py-1.5 text-xs font-semibold align-middle ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>
                      {formatCurrency(Number(t.amount))}
                    </TableCell>
                    <TableCell className="text-center px-2 py-1.5 align-middle">
                      {role?.isEditor && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={!draft || isSaving}
                          onClick={() => { setSavingId(t.id); updateDate.mutate({ id: t.id, date: draft, isChecks: checksAccountIds.has(t.account_id) }); }}
                          className="h-7 px-2"
                        >
                          <Save className="w-3.5 h-3.5 ml-1" />שמור
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/30 text-sm text-muted-foreground">
          <span>סה״כ {filtered.length} תנועות · {accountsWithRows.length} חשבונות</span>
          <span className="font-semibold text-expense tabular-nums">{formatCurrency(totalAmt)}</span>
        </div>
      </div>
    </ReportShell>
  );
}

