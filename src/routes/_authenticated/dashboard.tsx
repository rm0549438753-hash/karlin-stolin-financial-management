import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertsBanner } from "@/components/AlertsBanner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TransactionDialog } from "@/components/TransactionDialog";
import { formatCurrency } from "@/lib/format";
import { useAccounts, useCategories, useSubcategories, useExpenseTypes, useFunds } from "@/hooks/use-lookups";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LabelList,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Scale, Download, Printer, Search, History } from "lucide-react";
import { format } from "date-fns";
import { PrintDialog, type PrintColumn } from "@/components/PrintDialog";
import { useUserRole } from "@/hooks/use-auth";
import { ExportMenu } from "@/components/ExportMenu";
import { exportRowsAsPdf, objectsToTable } from "@/lib/export-pdf";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const CHART_COLORS = ["hsl(220 70% 55%)", "hsl(155 60% 45%)", "hsl(75 80% 55%)", "hsl(25 80% 55%)", "hsl(295 60% 55%)", "hsl(200 70% 50%)", "hsl(340 70% 55%)"];
const PROJECT_EXPENSE_TYPE = "בית הכנסת - בניה";
const IRRELEVANT_FUND = "לא רלוונטי";
const TRANSACTION_SELECT = "id, transaction_date, value_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit, payee, reference, association";
const PAGE_SIZE = 1000;

type Tx = {
  id: string;
  transaction_date: string; // effective date (after coalesce/override)
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
  reference: string | null;
  association: string | null;
};

type RawTx = Omit<Tx, "transaction_date"> & { transaction_date: string | null };

async function fetchAllDashboardTransactions() {
  const rows: RawTx[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TRANSACTION_SELECT)
      .or("transaction_date.not.is.null,value_date.not.is.null")
      .order("transaction_date", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as RawTx[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }


  return rows;
}

function DashboardPage() {
  const { data: rawTxs = [], isLoading } = useQuery({
    queryKey: ["tx-dashboard-full"],
    queryFn: fetchAllDashboardTransactions,
  });

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: funds = [] } = useFunds();

  // Effective-date rules:
  //  - Checks account → always use value_date.
  //  - Other accounts → transaction_date, fallback to value_date.
  //  - No date at all → excluded (appears only in the "no date" report).
  const checksAccountIds = useMemo(
    () => new Set(accounts.filter((a: any) => a.schema_type === "checks").map((a: any) => a.id)),
    [accounts],
  );

  const txsEffective = useMemo<Tx[]>(
    () => rawTxs.flatMap((t) => {
      const effective = checksAccountIds.has(t.account_id)
        ? t.value_date
        : (t.transaction_date ?? t.value_date);
      return effective ? [{ ...t, transaction_date: effective }] : [];
    }),
    [rawTxs, checksAccountIds],
  );


  const projectExpenseTypeId = useMemo(
    () => expenseTypes.find((e) => e.name === PROJECT_EXPENSE_TYPE)?.id,
    [expenseTypes],
  );
  const irrelevantFundId = useMemo(
    () => funds.find((f) => f.name === IRRELEVANT_FUND)?.id,
    [funds],
  );
  const vaultFundIds = useMemo(
    () => new Set(funds.filter((f: any) => f.is_vault).map((f) => f.id)),
    [funds],
  );


  // Note: transactions without a `transaction_date` are excluded at the query level
  // so they don't affect charts, pies, totals or drill-downs.
  const baseTxs = useMemo(
    () => txsEffective.filter((t) => !irrelevantFundId || t.fund_id !== irrelevantFundId),
    [txsEffective, irrelevantFundId],
  );



  // Logic rules:
  // - Fund = "לא רלוונטי" → already excluded from baseTxs (excluded everywhere).
  // - Any other fund assigned → ONLY in vaults report.
  // - No fund assigned → goes to institution or project tab based on expense_type.
  const institutionTxs = useMemo(
    () => baseTxs.filter((t) =>
      !t.fund_id && t.expense_type_id !== projectExpenseTypeId
    ),
    [baseTxs, projectExpenseTypeId],
  );

  const projectTxs = useMemo(
    () => baseTxs.filter((t) =>
      !t.fund_id && t.expense_type_id === projectExpenseTypeId
    ),
    [baseTxs, projectExpenseTypeId],
  );

  const vaultTxs = useMemo(
    () => baseTxs.filter((t) => !!t.fund_id),
    [baseTxs],
  );

  const lookups = { accounts, categories, subcategories, expenseTypes, funds };

  const [newTxOpen, setNewTxOpen] = useState(false);
  const { data: role } = useUserRole();

  useEffect(() => {
    const open = () => setNewTxOpen(true);
    window.addEventListener("lovable:new-tx", open);
    return () => window.removeEventListener("lovable:new-tx", open);
  }, []);

  return (
    <AppShell
      title="לוח בקרה"
      actions={
        <Button asChild variant="secondary" size="sm" className="font-bold">
          <Link to="/action-history" className="flex items-center gap-1.5">
            <History className="w-4 h-4" />
            היסטוריית פעולות
          </Link>
        </Button>
      }
    >
      <AlertsBanner />
      <Tabs defaultValue="institution" className="space-y-4 mt-4" dir="rtl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
        <TabsList className="flex flex-wrap h-auto max-w-3xl flex-1 gap-1">
          <TabsTrigger value="institution" className="text-base font-semibold px-4 py-2">
            מרכז קרלין סטולין
          </TabsTrigger>
          <TabsTrigger value="project" className="text-base font-semibold px-4 py-2">
            בית הכנסת - גבעת זאב
          </TabsTrigger>
          <TabsTrigger value="vaults" className="text-base font-semibold px-4 py-2">
            דו"ח קופות (הלוואות)
          </TabsTrigger>
        </TabsList>
          {role?.isEditor && <Button onClick={() => setNewTxOpen(true)}>+ תנועה חדשה</Button>}
        </div>


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
      <TransactionDialog open={newTxOpen} onOpenChange={setNewTxOpen} />
    </AppShell>

  );
}

/* ===================== Export helper ===================== */
function buildExportRows(rows: Tx[], lookups: any) {
  const catMap = new Map<string, string>(lookups.categories.map((c: any) => [c.id, c.name]));
  const subMap = new Map<string, string>(lookups.subcategories.map((s: any) => [s.id, s.name]));
  const etMap = new Map<string, string>(lookups.expenseTypes.map((e: any) => [e.id, e.name]));
  const acctMap = new Map<string, string>(lookups.accounts.map((a: any) => [a.id, a.name]));
  const fundMap = new Map<string, string>(lookups.funds.map((f: any) => [f.id, f.name]));

  return rows.map((t) => {
    const a = Number(t.amount);
    const credit = t.credit != null ? Number(t.credit) : (a > 0 ? a : 0);
    const debit = t.debit != null ? Number(t.debit) : (a < 0 ? -a : 0);
    return {
      "תאריך": format(new Date(t.transaction_date), "dd/MM/yyyy"),
      "חשבון": acctMap.get(t.account_id) ?? "",
      "פרטים": (t.description ?? t.payee ?? ""),
      "עמותה": (t as any).association ?? "",
      "סוג": t.expense_type_id ? etMap.get(t.expense_type_id) ?? "" : "",
      "קטגוריה": t.category_id ? catMap.get(t.category_id) ?? "" : "",
      "תת-קטגוריה": t.subcategory_id ? subMap.get(t.subcategory_id) ?? "" : "",
      "קופה": t.fund_id ? fundMap.get(t.fund_id) ?? "" : "",
      "זכות": credit || "",
      "חובה": debit || "",
      "הערה": t.note ?? "",
    };
  });
}

function exportTxsToExcel(rows: Tx[], lookups: any, filename: string) {
  const data = buildExportRows(rows, lookups);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "פירוט");
  XLSX.writeFile(wb, filename);
}

function exportTxsToPdf(rows: Tx[], lookups: any, title: string) {
  const data = buildExportRows(rows, lookups);
  const { headers, data: matrix } = objectsToTable(data);
  exportRowsAsPdf(title, headers, matrix);
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
    return Array.from(by.values()).sort((a, b) => b.value - a.value);
  }, [pieFilteredTxs, etMap]);

  const incomeTypeData = useMemo(() => {
    const by = new Map<string, { id: string; name: string; value: number }>();
    pieFilteredTxs.filter((t) => Number(t.amount) > 0).forEach((t) => {
      const key = t.expense_type_id ?? "__none__";
      const name = t.expense_type_id ? (etMap.get(t.expense_type_id) ?? "ללא סוג") : "ללא סוג";
      if (!by.has(key)) by.set(key, { id: key, name, value: 0 });
      by.get(key)!.value += Number(t.amount);
    });
    return Array.from(by.values()).sort((a, b) => b.value - a.value);
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
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">אין נתונים</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center" dir="rtl">
            {/* Right side: big pie + total */}
            <div className="flex flex-col items-center justify-center order-1">
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={130}
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
              <div className="mt-2 text-center">
                <div className="text-xs text-muted-foreground">סה"כ</div>
                <div className={"text-2xl font-extrabold tabular-nums " + (kind === "income" ? "text-income" : "text-expense")}>
                  {formatCurrency(total)}
                </div>
              </div>
            </div>
            {/* Left side: detailed legend list */}
            <ul className="space-y-1.5 text-sm max-h-[360px] overflow-y-auto pl-1 order-2">
              {data.map((d, i) => {
                const pct = total ? ((d.value / total) * 100).toFixed(1) : "0";
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/60 rounded px-2 py-1.5 border border-transparent hover:border-border"
                    onClick={() => openTypeDrill(d.id, d.name, kind)}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3.5 h-3.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate font-medium">{d.name}</span>
                    </span>
                    <span className="font-bold tabular-nums whitespace-nowrap">
                      {formatCurrency(d.value)} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
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
                <LabelList dataKey="הכנסות" position="top" fontSize={11} fontWeight={600} fill="hsl(155 65% 30%)" formatter={(v: number) => v ? compactFmt(v) : ""} />
              </Bar>
              <Bar dataKey="הוצאות" fill="hsl(0 75% 55%)" radius={[4, 4, 0, 0]} cursor="pointer"
                onClick={(d: any) => openMonth(d.key, "expense", d.label)}>
                <LabelList dataKey="הוצאות" position="top" fontSize={11} fontWeight={600} fill="hsl(0 75% 40%)" formatter={(v: number) => v ? compactFmt(v) : ""} />
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
  const navigate = useNavigate();
  const catMap = new Map<string, string>(lookups.categories.map((c: any) => [c.id, c.name]));
  const etMap = new Map<string, string>(lookups.expenseTypes.map((e: any) => [e.id, e.name]));
  const acctMap = new Map<string, string>((lookups.accounts ?? []).map((a: any) => [a.id, a.name]));
  const checksAccountIds = new Set<string>((lookups.accounts ?? []).filter((a: any) => a.schema_type === "checks").map((a: any) => a.id));
  const showAssoc = (drill?.rows ?? []).some((t: any) => checksAccountIds.has(t.account_id));
  const [search, setSearch] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    setSearch("");
  }, [drill?.title]);

  const filteredRows = useMemo(() => {
    const rows = drill?.rows ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) => [
      t.transaction_date,
      format(new Date(t.transaction_date), "dd/MM/yy"),
      acctMap.get(t.account_id),
      t.description,
      t.note,
      t.payee,
      t.reference,
      (t as any).association,
      t.expense_type_id ? etMap.get(t.expense_type_id) : "",
      t.category_id ? catMap.get(t.category_id) : "",
      String(t.amount),
      formatCurrency(Number(t.amount)),
    ].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [drill?.rows, search, acctMap, etMap, catMap]);

  const total = filteredRows.reduce((s, t) => s + Number(t.amount), 0);

  const goToTx = (t: Tx) => {
    const acc = (t as any).account_id;
    if (!acc) return;
    onClose();
    navigate({ to: "/transactions", search: { account: acc, highlight: t.id } });
  };

  return (
    <Sheet open={!!drill} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="left" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{drill?.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-2 mb-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            מציג {filteredRows.length} מתוך {drill?.rows.length ?? 0} תנועות · סה"כ:{" "}
            <span className={total >= 0 ? "text-income" : "text-expense"}>{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2">
            <ExportMenu
              disabled={!drill?.rows.length}
              onExcel={() => drill && exportTxsToExcel(drill.rows, lookups, `${drill.title}.xlsx`)}
              onPdf={() => drill && exportTxsToPdf(drill.rows, lookups, drill.title)}
            />
            <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)} disabled={!drill?.rows.length}>
              <Printer className="w-4 h-4 ml-1" />הדפסה
            </Button>
          </div>

        </div>
        <PrintDialog
          open={printOpen}
          onOpenChange={setPrintOpen}
          title={drill?.title ?? "פירוט תנועות"}
          subtitle={`${filteredRows.length} מתוך ${drill?.rows.length ?? 0} תנועות`}
          scopes={[
            { id: "filtered", label: "תוצאות הסינון הנוכחי", rows: filteredRows },
            { id: "all", label: "כל התנועות בפירוט", rows: drill?.rows ?? [] },
          ]}
          columns={[
            { id: "date", header: "תאריך", align: "right", format: (t: Tx) => format(new Date(t.transaction_date), "dd/MM/yy") },
            { id: "account", header: "חשבון", align: "right", format: (t: Tx) => acctMap.get(t.account_id) ?? "—" },
            { id: "desc", header: "תיאור", align: "right", format: (t: Tx) => (t.description ?? t.payee ?? "—") },
            { id: "payee", header: "שם מוטב", align: "right", format: (t: Tx) => t.payee ?? "—" },
            { id: "ref", header: "אסמכתה", align: "right", format: (t: Tx) => t.reference ?? "—" },
            { id: "type", header: "סוג", align: "right", format: (t: Tx) => (t.expense_type_id ? (etMap.get(t.expense_type_id) as string) : "—") },
            { id: "cat", header: "קטגוריה", align: "right", format: (t: Tx) => (t.category_id ? (catMap.get(t.category_id) as string) : "—") },
            { id: "amount", header: "סכום", align: "left", format: (t: Tx) => formatCurrency(Number(t.amount)) },
          ]}
          totals={[
            { label: "סך תנועות", value: filteredRows.length.toLocaleString("he-IL") },
            { label: 'סה"כ', value: formatCurrency(total), tone: total >= 0 ? "income" : "expense" },
          ]}
        />
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש בתיאור / אסמכתה / הערה / שם"
            className="pr-9 bg-card"
          />
        </div>
        <div className="rounded-2xl border bg-card overflow-hidden">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">תאריך</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">חשבון</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">תיאור</TableHead>
                {showAssoc && <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">עמותה</TableHead>}
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">סוג</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">קטגוריה</TableHead>
                <TableHead className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-2 whitespace-nowrap">סכום</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={showAssoc ? 7 : 6} className="text-center text-muted-foreground py-12">לא נמצאו תנועות</TableCell></TableRow>
              )}
              {filteredRows.map((t, idx) => (
                <TableRow
                  key={t.id}
                  className={(idx % 2 ? "bg-muted/20 " : "") + "border-b border-border cursor-pointer hover:bg-primary/5 transition-colors"}
                  onClick={() => goToTx(t)}
                  title="פתח את התנועה בדף התנועות"
                >
                  <TableCell className="whitespace-nowrap tabular-nums border-l border-border/60 px-2 py-1.5 text-xs align-middle">{format(new Date(t.transaction_date), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-right whitespace-nowrap border-l border-border/60 px-2 py-1.5 text-xs align-middle">{(t as any).account_id ? (acctMap.get((t as any).account_id) ?? "—") : "—"}</TableCell>
                  <TableCell className="text-right border-l border-border/60 px-2 py-1.5 text-xs align-middle max-w-[280px] truncate">{(t.description ?? t.payee ?? "—")}</TableCell>
                  {showAssoc && <TableCell className="text-right border-l border-border/60 px-2 py-1.5 text-xs align-middle max-w-[160px] truncate">{(t as any).association ?? "—"}</TableCell>}
                  <TableCell className="text-right border-l border-border/60 px-2 py-1.5 text-xs align-middle">{t.expense_type_id ? (etMap.get(t.expense_type_id) as string) : "—"}</TableCell>
                  <TableCell className="text-right border-l border-border/60 px-2 py-1.5 text-xs align-middle">{t.category_id ? (catMap.get(t.category_id) as string) : "—"}</TableCell>
                  <TableCell className={`text-left whitespace-nowrap px-2 py-1.5 text-xs font-semibold tabular-nums align-middle ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>
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
    () => [...lookups.funds].sort((a: any, b: any) => a.name.localeCompare(b.name, "he")),

    [lookups.funds],
  );

  const [openVault, setOpenVault] = useState<{ id: string; name: string } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const navigate = useNavigate();
  const goToTx = (t: Tx) => {
    const acc = lookups.accounts.find((a: any) => a.id === t.account_id)?.id ?? "";
    navigate({ to: "/transactions", search: { account: acc, highlight: t.id } });
  };

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
            <div className="flex gap-2">
              <ExportMenu
                disabled={!openRows.length}
                onExcel={() => openVault && exportTxsToExcel(openRows, lookups, `דוח קופה - ${openVault.name}.xlsx`)}
                onPdf={() => openVault && exportTxsToPdf(openRows, lookups, `דוח קופה - ${openVault.name}`)}
              />
              <Button size="sm" variant="outline" onClick={() => setPrintOpen(true)} disabled={!openRows.length}>
                <Printer className="w-4 h-4 ml-1" />הדפסה
              </Button>
            </div>

          </div>
          <PrintDialog
            open={printOpen}
            onOpenChange={setPrintOpen}
            title={`דוח קופה — ${openVault?.name ?? ""}`}
            subtitle={`${openRows.length} תנועות`}
            scopes={[{ id: "all", label: "כל תנועות הקופה", rows: openRows }]}
            columns={[
              { id: "date", header: "תאריך", align: "right", format: (t: Tx) => format(new Date(t.transaction_date), "dd/MM/yy") },
              { id: "account", header: "חשבון", align: "right", format: (t: Tx) => acctMap.get(t.account_id) ?? "—" },
              { id: "desc", header: "פרטים", align: "right", format: (t: Tx) => (t.description ?? t.payee ?? "—") },
              { id: "payee", header: "שם מוטב", align: "right", format: (t: Tx) => t.payee ?? "—" },
              { id: "ref", header: "אסמכתה", align: "right", format: (t: Tx) => t.reference ?? "—" },
              { id: "type", header: "סוג", align: "right", format: (t: Tx) => (t.expense_type_id ? (etMap.get(t.expense_type_id) as string) : "—") },
              { id: "cat", header: "קטגוריה", align: "right", format: (t: Tx) => (t.category_id ? (catMap.get(t.category_id) as string) : "—") },
              { id: "sub", header: "תת-קטגוריה", align: "right", format: (t: Tx) => (t.subcategory_id ? (subMap.get(t.subcategory_id) as string) : "—") },
              { id: "credit", header: "זכות", align: "left", format: (t: Tx) => { const a = Number(t.amount); const c = t.credit != null ? Number(t.credit) : (a > 0 ? a : 0); return c ? formatCurrency(c) : ""; } },
              { id: "debit", header: "חובה", align: "left", format: (t: Tx) => { const a = Number(t.amount); const d = t.debit != null ? Number(t.debit) : (a < 0 ? -a : 0); return d ? formatCurrency(d) : ""; } },
            ]}
            totals={[
              { label: "תנועות", value: openRows.length.toLocaleString("he-IL") },
              { label: "יתרה", value: formatCurrency(openTotal), tone: openTotal >= 0 ? "income" : "expense" },
            ]}
          />
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
                      <TableRow key={t.id} className="border-b cursor-pointer hover:bg-accent/50" onClick={() => goToTx(t)}>
                        <TableCell className="text-right whitespace-nowrap">{format(new Date(t.transaction_date), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{acctMap.get(t.account_id) ?? "—"}</TableCell>
                        <TableCell className="text-right">{(t.description ?? t.payee ?? "—")}</TableCell>
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
