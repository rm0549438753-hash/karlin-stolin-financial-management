import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { useAccounts, useCategories, useSubcategories, useExpenseTypes, useFunds } from "@/hooks/use-lookups";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Scale, Wallet, Building2, HardHat, PiggyBank } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const CHART_COLORS = ["hsl(220 70% 55%)", "hsl(155 60% 45%)", "hsl(75 80% 55%)", "hsl(25 80% 55%)", "hsl(295 60% 55%)", "hsl(200 70% 50%)", "hsl(340 70% 55%)"];
const PROJECT_EXPENSE_TYPE = "בית הכנסת - בניה";
const IRRELEVANT_FUND = "לא רלוונטי";

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

function DashboardPage() {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["tx-dashboard-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
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

  // Base: exclude "לא רלוונטי" fund from everything
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
    () => baseTxs.filter((t) => t.expense_type_id === projectExpenseTypeId),
    [baseTxs, projectExpenseTypeId],
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
          <OverviewTab txs={institutionTxs} lookups={lookups} title="מוסד" />
        </TabsContent>
        <TabsContent value="project">
          <OverviewTab txs={projectTxs} lookups={lookups} title="פרויקט בנייה" />
        </TabsContent>
        <TabsContent value="vaults">
          <VaultsTab txs={vaultTxs} lookups={lookups} />
        </TabsContent>
      </Tabs>
      {isLoading && <p className="text-center text-sm text-muted-foreground mt-6">טוען נתונים…</p>}
    </AppShell>
  );
}

type Lookups = {
  accounts: ReturnType<typeof useAccounts>["data"] extends infer A ? A : never;
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string | null }[];
  expenseTypes: { id: string; name: string }[];
  funds: { id: string; name: string; is_vault?: boolean }[];
};

/* ===================== Overview (Tabs 1 + 2) ===================== */
function OverviewTab({ txs, lookups, title }: { txs: Tx[]; lookups: any; title: string }) {
  const catMap = useMemo(() => new Map(lookups.categories.map((c: any) => [c.id, c.name])), [lookups.categories]);

  const income = txs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expense = txs.filter((t) => Number(t.amount) < 0).reduce((s, t) => s + Number(t.amount), 0);
  const net = income + expense;

  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; הכנסות: number; הוצאות: number; key: string }>();
    txs.forEach((t) => {
      const key = t.transaction_date.slice(0, 7);
      if (!map.has(key)) {
        const [y, m] = key.split("-");
        const label = new Date(Number(y), Number(m) - 1).toLocaleDateString("he-IL", { month: "short", year: "2-digit" });
        map.set(key, { key, label, הכנסות: 0, הוצאות: 0 });
      }
      const row = map.get(key)!;
      const a = Number(t.amount);
      if (a > 0) row.הכנסות += a;
      else row.הוצאות += -a;
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  }, [txs]);

  const categoryData = useMemo(() => {
    const by = new Map<string, { name: string; value: number; ids: Set<string> }>();
    txs.filter((t) => Number(t.amount) < 0).forEach((t) => {
      const name = t.category_id ? (catMap.get(t.category_id) as string ?? "ללא קטגוריה") : "ללא קטגוריה";
      const key = t.category_id ?? "__none__";
      if (!by.has(key)) by.set(key, { name, value: 0, ids: new Set() });
      const e = by.get(key)!;
      e.value += Math.abs(Number(t.amount));
      e.ids.add(t.id);
    });
    return Array.from(by.entries())
      .map(([id, v]) => ({ id, name: v.name, value: v.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [txs, catMap]);

  const [drill, setDrill] = useState<{ title: string; rows: Tx[] } | null>(null);

  const openMonth = (monthKey: string, kind: "all" | "income" | "expense", label: string) => {
    const rows = txs.filter((t) => {
      if (!t.transaction_date.startsWith(monthKey)) return false;
      if (kind === "income") return Number(t.amount) > 0;
      if (kind === "expense") return Number(t.amount) < 0;
      return true;
    });
    setDrill({ title: `${label} — ${kind === "income" ? "הכנסות" : kind === "expense" ? "הוצאות" : "כל התנועות"}`, rows });
  };

  const openCategory = (catId: string, name: string) => {
    const rows = txs.filter((t) => Number(t.amount) < 0 && (t.category_id ?? "__none__") === catId);
    setDrill({ title: `${name} — פירוט הוצאות`, rows });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="הכנסות" value={formatCurrency(income)} icon={TrendingUp} tone="income" />
        <KPI title="הוצאות" value={formatCurrency(Math.abs(expense))} icon={TrendingDown} tone="expense" />
        <KPI title="מאזן" value={formatCurrency(net)} icon={Scale} tone={net >= 0 ? "income" : "expense"} />
        <KPI title={`סה"כ תנועות — ${title}`} value={txs.length.toLocaleString("he-IL")} icon={Wallet} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>הכנסות מול הוצאות (חודשי)</CardTitle></CardHeader>
          <CardContent>
            {monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">אין נתונים</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthly} onClick={(e: any) => {
                  if (!e?.activePayload?.length) return;
                  const item = e.activePayload[0].payload;
                  const dk = e.activePayload[0].dataKey;
                  openMonth(item.key, dk === "הכנסות" ? "income" : "expense", item.label);
                }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} reversed />
                  <YAxis fontSize={12} orientation="right" tickFormatter={(v) => new Intl.NumberFormat("he-IL", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="הכנסות" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} cursor="pointer" />
                  <Bar dataKey="הוצאות" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>פילוח הוצאות לפי קטגוריה</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">אין נתונים</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={100}
                    cursor="pointer"
                    onClick={(d: any) => openCategory(d.id, d.name)}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <DrillSheet drill={drill} onClose={() => setDrill(null)} lookups={lookups} />
    </div>
  );
}

/* ===================== Drill-down Sheet ===================== */
function DrillSheet({ drill, onClose, lookups }: { drill: { title: string; rows: Tx[] } | null; onClose: () => void; lookups: any }) {
  const catMap = new Map(lookups.categories.map((c: any) => [c.id, c.name]));
  const subMap = new Map(lookups.subcategories.map((s: any) => [s.id, s.name]));
  const total = drill?.rows.reduce((s, t) => s + Number(t.amount), 0) ?? 0;
  return (
    <Sheet open={!!drill} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{drill?.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-2 mb-4 text-sm text-muted-foreground">
          {drill?.rows.length ?? 0} תנועות · סה"כ: <span className={total >= 0 ? "text-income" : "text-expense"}>{formatCurrency(total)}</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">תיאור</TableHead>
              <TableHead className="text-right">קטגוריה</TableHead>
              <TableHead className="text-left">סכום</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drill?.rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap">{format(new Date(t.transaction_date), "dd/MM/yy")}</TableCell>
                <TableCell className="text-right">{t.description ?? "—"}</TableCell>
                <TableCell className="text-right">{t.category_id ? (catMap.get(t.category_id) as string) : "—"}</TableCell>
                <TableCell className={`text-left whitespace-nowrap ${Number(t.amount) >= 0 ? "text-income" : "text-expense"}`}>
                  {formatCurrency(Number(t.amount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

  const [selectedVault, setSelectedVault] = useState<string>("");
  const selectedRows = useMemo(
    () => selectedVault ? txs.filter((t) => t.fund_id === selectedVault).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)) : [],
    [selectedVault, txs],
  );

  const catMap = new Map(lookups.categories.map((c: any) => [c.id, c.name]));
  const subMap = new Map(lookups.subcategories.map((s: any) => [s.id, s.name]));
  const etMap = new Map(lookups.expenseTypes.map((e: any) => [e.id, e.name]));
  const acctMap = new Map(lookups.accounts.map((a: any) => [a.id, a.name]));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>דוח קופות</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setSelectedVault(r.id)}
                  >
                    <TableCell className="text-right font-medium">{r.name}</TableCell>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>דוח קופה — פירוט</CardTitle>
            <div className="min-w-[240px]">
              <Select value={selectedVault} onValueChange={setSelectedVault}>
                <SelectTrigger><SelectValue placeholder="בחר קופה…" /></SelectTrigger>
                <SelectContent>
                  {vaultFunds.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedVault ? (
            <p className="text-sm text-muted-foreground py-12 text-center">בחר קופה להצגת פירוט התנועות</p>
          ) : selectedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">אין תנועות עבור הקופה הנבחרת</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">חשבון</TableHead>
                    <TableHead className="text-left">זכות</TableHead>
                    <TableHead className="text-left">חובה</TableHead>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">פרטים</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">תת-קטגוריה</TableHead>
                    <TableHead className="text-right">הערה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRows.map((t) => {
                    const a = Number(t.amount);
                    const credit = t.credit != null ? Number(t.credit) : (a > 0 ? a : 0);
                    const debit = t.debit != null ? Number(t.debit) : (a < 0 ? -a : 0);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-right whitespace-nowrap">{acctMap.get(t.account_id) ?? "—"}</TableCell>
                        <TableCell className="text-left text-income whitespace-nowrap">{credit ? formatCurrency(credit) : ""}</TableCell>
                        <TableCell className="text-left text-expense whitespace-nowrap">{debit ? formatCurrency(debit) : ""}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{format(new Date(t.transaction_date), "dd/MM/yy")}</TableCell>
                        <TableCell className="text-right">{t.description ?? "—"}</TableCell>
                        <TableCell className="text-right">{t.expense_type_id ? (etMap.get(t.expense_type_id) as string) : "—"}</TableCell>
                        <TableCell className="text-right">{t.category_id ? (catMap.get(t.category_id) as string) : "—"}</TableCell>
                        <TableCell className="text-right">{t.subcategory_id ? (subMap.get(t.subcategory_id) as string) : "—"}</TableCell>
                        <TableCell className="text-right">{t.note ?? ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
