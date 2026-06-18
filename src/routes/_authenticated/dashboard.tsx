import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAccounts, useCategories, useSubcategories, useExpenseTypes, useFunds } from "@/hooks/use-lookups";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Scale, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const CHART_COLORS = ["hsl(220 70% 55%)", "hsl(155 60% 45%)", "hsl(75 80% 55%)", "hsl(25 80% 55%)", "hsl(295 60% 55%)", "hsl(200 70% 50%)", "hsl(340 70% 55%)"];
const ALL = "__all__";

type Tx = {
  id: string;
  transaction_date: string;
  amount: number;
  account_id: string;
  fund_id: string | null;
  expense_type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
};

function DashboardPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: funds = [] } = useFunds();

  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [accountId, setAccountId] = useState<string>(ALL);
  const [fundId, setFundId] = useState<string>(ALL);
  const [expenseTypeId, setExpenseTypeId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [subcategoryId, setSubcategoryId] = useState<string>(ALL);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["tx-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id");
      if (error) throw error;
      return data as Tx[];
    },
  });

  const filteredSubcategories = useMemo(
    () => subcategories.filter((s) => categoryId === ALL || s.category_id === categoryId),
    [subcategories, categoryId],
  );

  const filtered = useMemo(() => {
    const fromStr = from ? format(from, "yyyy-MM-dd") : null;
    const toStr = to ? format(to, "yyyy-MM-dd") : null;
    return txs.filter((t) => {
      if (fromStr && t.transaction_date < fromStr) return false;
      if (toStr && t.transaction_date > toStr) return false;
      if (accountId !== ALL && t.account_id !== accountId) return false;
      if (fundId !== ALL && t.fund_id !== fundId) return false;
      if (expenseTypeId !== ALL && t.expense_type_id !== expenseTypeId) return false;
      if (categoryId !== ALL && t.category_id !== categoryId) return false;
      if (subcategoryId !== ALL && t.subcategory_id !== subcategoryId) return false;
      return true;
    });
  }, [txs, from, to, accountId, fundId, expenseTypeId, categoryId, subcategoryId]);

  const hasFilters = !!from || !!to || accountId !== ALL || fundId !== ALL || expenseTypeId !== ALL || categoryId !== ALL || subcategoryId !== ALL;
  const resetFilters = () => {
    setFrom(undefined); setTo(undefined);
    setAccountId(ALL); setFundId(ALL); setExpenseTypeId(ALL); setCategoryId(ALL); setSubcategoryId(ALL);
  };

  const income = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expense = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0);
  const net = income + expense;
  const total = txs.reduce((s, t) => s + Number(t.amount), 0);

  // monthly series — span of filtered range, or last 12 months by default
  const monthly = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    if (from || to) {
      start = from ?? new Date(Math.min(...filtered.map((t) => +new Date(t.transaction_date))));
      end = to ?? new Date(Math.max(...filtered.map((t) => +new Date(t.transaction_date))));
      if (!isFinite(+start)) start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      if (!isFinite(+end)) end = now;
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      end = now;
    }
    const buckets: { key: string; label: string }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      buckets.push({
        key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
        label: cur.toLocaleDateString("he-IL", { month: "short", year: "2-digit" }),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return buckets.slice(-24).map((m) => {
      const arr = filtered.filter((t) => t.transaction_date.startsWith(m.key));
      return {
        label: m.label,
        הכנסות: arr.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0),
        הוצאות: -arr.filter((t) => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0),
      };
    });
  }, [filtered, from, to]);

  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const byCat = new Map<string, number>();
  filtered.filter((t) => t.amount < 0).forEach((t) => {
    const name = t.category_id ? (catMap.get(t.category_id) ?? "ללא קטגוריה") : "ללא קטגוריה";
    byCat.set(name, (byCat.get(name) ?? 0) + Math.abs(Number(t.amount)));
  });
  const categoryData = Array.from(byCat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  // balance per account — always over ALL transactions (true running balance)
  const balByAcct = new Map<string, number>();
  txs.forEach((t) => balByAcct.set(t.account_id, (balByAcct.get(t.account_id) ?? 0) + Number(t.amount)));

  return (
    <AppShell title="לוח בקרה">
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <DateField label="מתאריך" value={from} onChange={setFrom} />
              <DateField label="עד תאריך" value={to} onChange={setTo} />
              <FilterSelect
                label="קופה"
                value={fundId}
                onChange={setFundId}
                options={funds.map((f) => ({ value: f.id, label: f.name }))}
              />
              <FilterSelect
                label="סוג"
                value={expenseTypeId}
                onChange={setExpenseTypeId}
                options={expenseTypes.map((e) => ({ value: e.id, label: e.name }))}
              />
              <FilterSelect
                label="קטגוריה"
                value={categoryId}
                onChange={(v) => { setCategoryId(v); setSubcategoryId(ALL); }}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <FilterSelect
                label="תת-קטגוריה"
                value={subcategoryId}
                onChange={setSubcategoryId}
                options={filteredSubcategories.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
            {hasFilters && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{filtered.length.toLocaleString("he-IL")} תנועות תואמות</span>
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="w-4 h-4 ms-1" />
                  נקה פילטרים
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI title="הכנסות" value={formatCurrency(income)} icon={TrendingUp} tone="income" />
          <KPI title="הוצאות" value={formatCurrency(Math.abs(expense))} icon={TrendingDown} tone="expense" />
          <KPI title="מאזן" value={formatCurrency(net)} icon={Scale} tone={net >= 0 ? "income" : "expense"} />
          <KPI title="יתרה כוללת" value={formatCurrency(total)} icon={Wallet} tone="primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>הכנסות מול הוצאות</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} reversed />
                  <YAxis fontSize={12} orientation="right" tickFormatter={(v) => new Intl.NumberFormat("he-IL", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="הכנסות" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="הוצאות" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>פילוח הוצאות</CardTitle></CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">אין נתונים</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
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

        <Card>
          <CardHeader><CardTitle>יתרה לפי קופה</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {accounts.map((a) => {
                const v = balByAcct.get(a.id) ?? 0;
                return (
                  <div key={a.id} className="rounded-lg border bg-card p-3">
                    <div className="text-xs text-muted-foreground truncate">{a.name}</div>
                    <div className={`text-lg font-semibold ${v >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(v)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {isLoading && <p className="text-center text-sm text-muted-foreground">טוען נתונים…</p>}
        {txs.length === 0 && !isLoading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            עדיין אין תנועות. עברו ל<a className="text-primary underline" href="/transactions">תנועות</a> להוספת תנועה ראשונה.
          </CardContent></Card>
        )}
      </div>
    </AppShell>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: Date; onChange: (d?: Date) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-right font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="w-4 h-4 ms-2" />
            {value ? format(value, "dd/MM/yyyy", { locale: he }) : "בחר תאריך"}
            {value && (
              <X
                className="w-3.5 h-3.5 me-auto opacity-60 hover:opacity-100"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(undefined); }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>הכל</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

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
