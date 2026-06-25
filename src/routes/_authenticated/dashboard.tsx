import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useAccounts, useCategories, useSubcategories, useExpenseTypes, useFunds } from "@/hooks/use-lookups";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Scale, Building2, HardHat, PiggyBank, Download } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const CHART_COLORS = ["hsl(220 70% 55%)", "hsl(155 60% 45%)", "hsl(75 80% 55%)", "hsl(25 80% 55%)", "hsl(295 60% 55%)", "hsl(200 70% 50%)", "hsl(340 70% 55%)"];
const PROJECT_EXPENSE_TYPE = "בית הכנסת - בניה";
const IRRELEVANT_FUND = "לא רלוונטי";
const TRANSACTION_SELECT = "id, transaction_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit";
const PAGE_SIZE = 1000;

type Tx = {
  id: string;
  transaction_date: string;
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
};

async function fetchAllDashboardTransactions() {
  const rows: Tx[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TRANSACTION_SELECT)
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

function DashboardPage() {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["tx-dashboard-full"],
    queryFn: fetchAllDashboardTransactions,
  });

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: funds = [] } = useFunds();

  const projectExpenseTypeId = useMemo(
    () => expenseTypes.find((e) => e.name === PROJECT_EXPENSE_TYPE)?.id,
    [expenseTypes],
  );
  const irrelevantFundId = useMemo(
    () => funds.find((f) => f.name === IRRELEVANT_FUND)?.id,
    [funds],
  );
  const vaultFundIds = useMemo(
    () => new Set(funds.filter((f) => f.is_vault).map((f) => f.id)),
    [funds],
  );

  const baseTxs = useMemo(
    () => txs.filter((t) => !irrelevantFundId || t.fund_id !== irrelevantFundId),
    [txs, irrelevantFundId],
  );

  const institutionTxs = useMemo(
    () => baseTxs.filter((t) =>
      t.expense_type_id !== projectExpenseTypeId &&
      !(t.fund_id && vaultFundIds.has(t.fund_id))
    ),
    [baseTxs, projectExpenseTypeId, vaultFundIds],
  );

  const projectTxs = useMemo(
    () => baseTxs.filter((t) =>
      t.expense_type_id === projectExpenseTypeId &&
      !(t.fund_id && vaultFundIds.has(t.fund_id))
    ),
    [baseTxs, projectExpenseTypeId, vaultFundIds],
  );

  const vaultTxs = useMemo(
    () => baseTxs.filter((t) => t.fund_id && vaultFundIds.has(t.fund_id)),
    [baseTxs, vaultFundIds],
  );

  const lookups = { accounts, categories, subcategories, expenseTypes, funds };

  return (
    <AppShell title="לוח בקרה">
      <Tabs defaultValue="institution" className="space-y-4" dir="rtl">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="institution" className="gap-2">
            <Building2 className="w-4 h-4" />
            ניהול שוטף (מוסד)
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-2">
            <HardHat className="w-4 h-4" />
            פרויקט בנייה
          </TabsTrigger>
          <TabsTrigger value="vaults" className="gap-2">
            <PiggyBank className="w-4 h-4" />
            ניהול קופות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="institution">
          <OverviewTab txs={institutionTxs} lookups={lookups} />
        </TabsContent>
        <TabsContent value="project">
          <OverviewTab txs={projectTxs} lookups={lookups} />
        </TabsContent>
        <TabsContent value="vaults">
          <VaultsTab txs={vaultTxs} lookups={lookups} />
        </TabsContent>
      </Tabs>
      {isLoading && <p className="text-center text-sm text-muted-foreground mt-6">טוען נתונים…</p>}
    </AppShell>
  );
}

/* ===================== Export helper ===================== */
function exportTxsToExcel(rows: Tx[], lookups: any, filename: string) {
  const catMap = new Map<string, string>(lookups.categories.map((c: any) => [c.id, c.name]));
  const subMap = new Map<string, string>(lookups.subcategories.map((s: any) => [s.id, s.name]));
  const etMap = new Map<string, string>(lookups.expenseTypes.map((e: any) => [e.id, e.name]));
  const acctMap = new Map<string, string>(lookups.accounts.map((a: any) => [a.id, a.name]));
  const fundMap = new Map<string, string>(lookups.funds.map((f: any) => [f.id, f.name]));

  const data = rows.map((t) => {
    const a = Number(t.amount);
    const credit = t.credit != null ? Number(t.credit) : (a > 0 ? a : 0);
    const debit = t.debit != null ? Number(t.debit) : (a < 0 ? -a : 0);
    return {
      "תאריך": format(new Date(t.transaction_date), "dd/MM/yyyy"),
      "חשבון": acctMap.get(t.account_id) ?? "",
      "פרטים": t.description ?? "",
      "סוג": t.expense_type_id ? etMap.get(t.expense_type_id) ?? "" : "",
      "קטגוריה": t.category_id ? catMap.get(t.category_id) ?? "" : "",
      "תת-קטגוריה": t.subcategory_id ? subMap.get(t.subcategory_id) ?? "" : "",
      "קופה": t.fund_id ? fundMap.get(t.fund_id) ?? "" : "",
      "זכות": credit || "",
      "חובה": debit || "",
      "הערה": t.note ?? "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "פירוט");
  XLSX.writeFile(wb, filename);
}

/* ===================== Overview (Tabs 1 + 2) ===================== */
function OverviewTab({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const etMap = useMemo(() => new Map<string, string>(lookups.expenseTypes.map((e: any) => [e.id, e.name])), [lookups.expenseTypes]);

  const income = txs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0);
  const net = income + expense;

  const yearsAvailable = useMemo(() => {
    const ys = new Set<string>();
    txs.forEach((t) => ys.add(t.transaction_date.slice(0, 4)));
    return Array.from(ys).sort().reverse();
  }, [txs]);
  const currentYear = String(new Date().getFullYear());
  const [barYear, setBarYear] = useState<string>(currentYear);

  const monthly = useMemo(() => {
    const monthNames = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
    const rows = monthNames.map((label, i) => {
      const mm = String(i + 1).padStart(2, "0");
      return { key: `${barYear}-${mm}`, label, הכנסות: 0, הוצאות: 0 };
    });
    txs.forEach((t) => {
      if (!t.transaction_date.startsWith(barYear)) return;
      const mi = Number(t.transaction_date.slice(5, 7)) - 1;
      const a = Number(t.amount);
      if (a > 0) rows[mi].הכנסות += a;
      else rows[mi].הוצאות += -a;
    });
    return rows;
  }, [txs, barYear]);

  // Pie filter (independent: year + month)
  const [pieYear, setPieYear] = useState<string>(currentYear);
  const [pieMonth, setPieMonth] = useState<string>("all"); // "all" | "01".."12"

  const pieFilteredTxs = useMemo(() => {
    return txs.filter((t) => {
      if (pieYear !== "all" && !t.transaction_date.startsWith(pieYear)) return false;
      if (pieMonth !== "all") {
        const mm = t.transaction_date.slice(5, 7);
        if (mm !== pieMonth) return false;
      }
      return true;
    });
  }, [txs, pieYear, pieMonth]);

  const expenseTypeData = useMemo(() => {
    const by = new Map<string, { id: string; name: string; value: number }>();
    pieFilteredTxs.filter((t) => Number(t.amount) < 0).forEach((t) => {
      const key = t.expense_type_id ?? "__none__";
      const name = t.expense_type_id ? (etMap.get(t.expense_type_id) ?? "ללא סוג") : "ללא סוג";
      if (!by.has(key)) by.set(key, { id: key, name, value: 0 });
      by.get(key)!.value += Math.abs(Number(t.amount));
    });
    return Array.from(by.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [pieFilteredTxs, etMap]);

  const incomeTypeData = useMemo(() => {
    const by = new Map<string, { id: string; name: string; value: number }>();
    pieFilteredTxs.filter((t) => Number(t.amount) > 0).forEach((t) => {
      const key = t.expense_type_id ?? "__none__";
      const name = t.expense_type_id ? (etMap.get(t.expense_type_id) ?? "ללא סוג") : "ללא סוג";
      if (!by.has(key)) by.set(key, { id: key, name, value: 0 });
      by.get(key)!.value += Number(t.amount);
    });
    return Array.from(by.values()).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [pieFilteredTxs, etMap]);

  const [drill, setDrill] = useState<{ title: string; rows: Tx[] } | null>(null);

  const openMonth = (monthKey: string, kind: "income" | "expense", label: string) => {
    const rows = txs.filter((t) => {
      if (!t.transaction_date.startsWith(monthKey)) return false;
      return kind === "income" ? Number(t.amount) > 0 : Number(t.amount) < 0;
    });
    setDrill({ title: `${label} ${monthKey.slice(0, 4)} — ${kind === "income" ? "הכנסות" : "הוצאות"}`, rows });
  };

  const openTypeDrill = (etId: string, name: string, kind: "income" | "expense") => {
    const rows = pieFilteredTxs.filter((t) =>
      (kind === "income" ? Number(t.amount) > 0 : Number(t.amount) < 0) &&
      (t.expense_type_id ?? "__none__") === etId,
    );
    setDrill({ title: `${name} — פירוט ${kind === "income" ? "הכנסות" : "הוצאות"}`, rows });
  };

  const months = [
    { v: "all", l: "כל השנה" },
    { v: "01", l: "ינואר" }, { v: "02", l: "פברואר" }, { v: "03", l: "מרץ" },
    { v: "04", l: "אפריל" }, { v: "05", l: "מאי" }, { v: "06", l: "יוני" },
    { v: "07", l: "יולי" }, { v: "08", l: "אוגוסט" }, { v: "09", l: "ספטמבר" },
    { v: "10", l: "אוקטובר" }, { v: "11", l: "נובמבר" }, { v: "12", l: "דצמבר" },
  ];

  const compactFmt = (v: number) => new Intl.NumberFormat("he-IL", { notation: "compact", maximumFractionDigits: 1 }).format(v);
  const expenseTotal = expenseTypeData.reduce((s, d) => s + d.value, 0);
  const incomeTotal = incomeTypeData.reduce((s, d) => s + d.value, 0);

  const renderPie = (
    data: { id: string; name: string; value: number }[],
    total: number,
    kind: "income" | "expense",
    title: string,
  ) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">אין נתונים</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={90}
                  cursor="pointer"
                  onClick={(d: any) => openTypeDrill(d.id, d.name, kind)}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-3 space-y-1.5 text-xs max-h-44 overflow-y-auto pr-1">
              {data.map((d, i) => {
                const pct = total ? ((d.value / total) * 100).toFixed(1) : "0";
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1"
                    onClick={() => openTypeDrill(d.id, d.name, kind)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="font-semibold tabular-nums whitespace-nowrap">
                      {formatCurrency(d.value)} <span className="text-muted-foreground font-normal">({pct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPI title="הכנסות" value={formatCurrency(income)} icon={TrendingUp} tone="income" />
        <KPI title="הוצאות" value={formatCurrency(Math.abs(expense))} icon={TrendingDown} tone="expense" />
        <KPI title="מאזן" value={formatCurrency(net)} icon={Scale} tone={net >= 0 ? "income" : "expense"} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>הכנסות מול הוצאות (חודשי)</CardTitle>
          <Select value={barYear} onValueChange={setBarYear}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(yearsAvailable.length ? yearsAvailable : [currentYear]).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={monthly} margin={{ top: 20, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" fontSize={12} reversed />
              <YAxis fontSize={12} orientation="right" tickFormatter={compactFmt} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="הכנסות" fill="hsl(155 65% 42%)" radius={[4, 4, 0, 0]} cursor="pointer"
                onClick={(d: any) => openMonth(d.key, "income", d.label)}>
                <LabelList dataKey="הכנסות" position="top" fontSize={10} formatter={(v: number) => v ? compactFmt(v) : ""} />
              </Bar>
              <Bar dataKey="הוצאות" fill="hsl(0 75% 55%)" radius={[4, 4, 0, 0]} cursor="pointer"
                onClick={(d: any) => openMonth(d.key, "expense", d.label)}>
                <LabelList dataKey="הוצאות" position="top" fontSize={10} formatter={(v: number) => v ? compactFmt(v) : ""} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle>פילוח לפי סוג</CardTitle>
          <div className="flex gap-2">
            <Select value={pieYear} onValueChange={setPieYear}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל השנים</SelectItem>
                {yearsAvailable.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={pieMonth} onValueChange={setPieMonth}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderPie(incomeTypeData, incomeTotal, "income", "פילוח הכנסות")}
            {renderPie(expenseTypeData, expenseTotal, "expense", "פילוח הוצאות")}
          </div>
        </CardContent>
      </Card>



      <DrillSheet drill={drill} onClose={() => setDrill(null)} lookups={lookups} />
    </div>
  );
}

/* ===================== Drill-down Sheet ===================== */
function DrillSheet({ drill, onClose, lookups }: { drill: { title: string; rows: Tx[] } | null; onClose: () => void; lookups: any }) {
  const catMap = new Map<string, string>(lookups.categories.map((c: any) => [c.id, c.name]));
  const etMap = new Map<string, string>(lookups.expenseTypes.map((e: any) => [e.id, e.name]));
  const acctMap = new Map<string, string>((lookups.accounts ?? []).map((a: any) => [a.id, a.name]));
  const total = drill?.rows.reduce((s, t) => s + Number(t.amount), 0) ?? 0;

  return (
    <Sheet open={!!drill} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="left" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{drill?.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-2 mb-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {drill?.rows.length ?? 0} תנועות · סה"כ:{" "}
            <span className={total >= 0 ? "text-income" : "text-expense"}>{formatCurrency(total)}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!drill?.rows.length}
            onClick={() => drill && exportTxsToExcel(drill.rows, lookups, `${drill.title}.xlsx`)}
          >
            <Download className="w-4 h-4 ml-1" />
            ייצוא לאקסל
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">חשבון</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">סוג</TableHead>
                <TableHead className="text-right">קטגוריה</TableHead>
                <TableHead className="text-left">סכום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drill?.rows.map((t) => (
                <TableRow key={t.id} className="border-b">
                  <TableCell className="whitespace-nowrap">{format(new Date(t.transaction_date), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{(t as any).account_id ? (acctMap.get((t as any).account_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-right">{t.description ?? "—"}</TableCell>
                  <TableCell className="text-right">{t.expense_type_id ? (etMap.get(t.expense_type_id) as string) : "—"}</TableCell>
                  <TableCell className="text-right">{t.category_id ? (catMap.get(t.category_id) as string) : "—"}</TableCell>
                  <TableCell className={`text-left whitespace-nowrap ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>
                    {formatCurrency(Number(t.amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ===================== Vaults Tab ===================== */
function VaultsTab({ txs, lookups }: { txs: Tx[]; lookups: any }) {
  const vaultFunds = useMemo(
    () => lookups.funds.filter((f: any) => f.is_vault).sort((a: any, b: any) => a.name.localeCompare(b.name, "he")),
    [lookups.funds],
  );

  const [openVault, setOpenVault] = useState<{ id: string; name: string } | null>(null);

  const summary = useMemo(() => {
    return vaultFunds.map((f: any) => {
      const rows = txs.filter((t) => t.fund_id === f.id);
      const credit = rows.reduce((s, t) => s + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0);
      const debit = rows.reduce((s, t) => s + (Number(t.amount) < 0 ? -Number(t.amount) : 0), 0);
      return { id: f.id, name: f.name, credit, debit, balance: credit - debit, count: rows.length };
    });
  }, [vaultFunds, txs]);

  const totals = useMemo(() => summary.reduce(
    (acc: any, r: any) => ({ credit: acc.credit + r.credit, debit: acc.debit + r.debit, balance: acc.balance + r.balance }),
    { credit: 0, debit: 0, balance: 0 },
  ), [summary]);

  const openRows = useMemo(
    () => openVault ? txs.filter((t) => t.fund_id === openVault.id).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)) : [],
    [openVault, txs],
  );

  const catMap = new Map<string, string>(lookups.categories.map((c: any) => [c.id, c.name]));
  const subMap = new Map<string, string>(lookups.subcategories.map((s: any) => [s.id, s.name]));
  const etMap = new Map<string, string>(lookups.expenseTypes.map((e: any) => [e.id, e.name]));
  const acctMap = new Map<string, string>(lookups.accounts.map((a: any) => [a.id, a.name]));

  const openTotal = openRows.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>דוח קופות</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">לחץ על שם הקופה לפתיחת פירוט</p>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">קופה</TableHead>
                  <TableHead className="text-left">נכנס לקופה</TableHead>
                  <TableHead className="text-left">יצא מהקופה</TableHead>
                  <TableHead className="text-left">יתרה</TableHead>
                  <TableHead className="text-left">תנועות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((r: any) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-accent/50 border-b"
                    onClick={() => setOpenVault({ id: r.id, name: r.name })}
                  >
                    <TableCell className="text-right font-medium text-primary underline-offset-2 hover:underline">{r.name}</TableCell>
                    <TableCell className="text-left text-income whitespace-nowrap">{formatCurrency(r.credit)}</TableCell>
                    <TableCell className="text-left text-expense whitespace-nowrap">{formatCurrency(r.debit)}</TableCell>
                    <TableCell className={`text-left whitespace-nowrap font-semibold ${r.balance >= 0 ? "text-income" : "text-expense"}`}>
                      {formatCurrency(r.balance)}
                    </TableCell>
                    <TableCell className="text-left">{r.count}</TableCell>
                  </TableRow>
                ))}
                {summary.length > 0 && (
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell className="text-right">סה"כ</TableCell>
                    <TableCell className="text-left text-income">{formatCurrency(totals.credit)}</TableCell>
                    <TableCell className="text-left text-expense">{formatCurrency(totals.debit)}</TableCell>
                    <TableCell className={`text-left ${totals.balance >= 0 ? "text-income" : "text-expense"}`}>
                      {formatCurrency(totals.balance)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
                {summary.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">אין קופות מוגדרות</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!openVault} onOpenChange={(o) => { if (!o) setOpenVault(null); }}>
        <SheetContent side="left" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>דוח קופה — {openVault?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-2 mb-4 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-sm text-muted-foreground">
              {openRows.length} תנועות · יתרה:{" "}
              <span className={openTotal >= 0 ? "text-income" : "text-expense"}>{formatCurrency(openTotal)}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!openRows.length}
              onClick={() => openVault && exportTxsToExcel(openRows, lookups, `דוח קופה - ${openVault.name}.xlsx`)}
            >
              <Download className="w-4 h-4 ml-1" />
              ייצוא לאקסל
            </Button>
          </div>
          {openRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">אין תנועות עבור הקופה</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">חשבון</TableHead>
                    <TableHead className="text-right">פרטים</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">תת-קטגוריה</TableHead>
                    <TableHead className="text-left">זכות</TableHead>
                    <TableHead className="text-left">חובה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openRows.map((t) => {
                    const a = Number(t.amount);
                    const credit = t.credit != null ? Number(t.credit) : (a > 0 ? a : 0);
                    const debit = t.debit != null ? Number(t.debit) : (a < 0 ? -a : 0);
                    return (
                      <TableRow key={t.id} className="border-b">
                        <TableCell className="text-right whitespace-nowrap">{format(new Date(t.transaction_date), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{acctMap.get(t.account_id) ?? "—"}</TableCell>
                        <TableCell className="text-right">{t.description ?? "—"}</TableCell>
                        <TableCell className="text-right">{t.expense_type_id ? (etMap.get(t.expense_type_id) as string) : "—"}</TableCell>
                        <TableCell className="text-right">{t.category_id ? (catMap.get(t.category_id) as string) : "—"}</TableCell>
                        <TableCell className="text-right">{t.subcategory_id ? (subMap.get(t.subcategory_id) as string) : "—"}</TableCell>
                        <TableCell className="text-left text-income whitespace-nowrap">{credit ? formatCurrency(credit) : ""}</TableCell>
                        <TableCell className="text-left text-expense whitespace-nowrap">{debit ? formatCurrency(debit) : ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ===================== KPI Card ===================== */
function KPI({ title, value, icon: Icon, tone }: { title: string; value: string; icon: any; tone: "income" | "expense" | "primary" }) {
  const toneClass =
    tone === "income" ? "text-income bg-income/10"
    : tone === "expense" ? "text-expense bg-expense/10"
    : "text-primary bg-primary/10";
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl grid place-items-center ${toneClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="text-xl font-bold truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
