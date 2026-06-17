import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useAccounts } from "@/hooks/use-lookups";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { TrendingUp, TrendingDown, Scale, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const CHART_COLORS = ["hsl(220 70% 55%)", "hsl(155 60% 45%)", "hsl(75 80% 55%)", "hsl(25 80% 55%)", "hsl(295 60% 55%)", "hsl(200 70% 50%)", "hsl(340 70% 55%)"];

type Tx = {
  id: string;
  transaction_date: string;
  amount: number;
  account_id: string;
  category_id: string | null;
};

function DashboardPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["tx-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, amount, account_id, category_id");
      if (error) throw error;
      return data as Tx[];
    },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name");
      return data ?? [];
    },
  });

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = txs.filter((t) => t.transaction_date.startsWith(ym));
  const income = thisMonth.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
  const expense = thisMonth.filter((t) => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0);
  const net = income + expense;
  const total = txs.reduce((s, t) => s + Number(t.amount), 0);

  // monthly series last 12
  const months: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("he-IL", { month: "short", year: "2-digit" }),
    });
  }
  const monthly = months.map((m) => {
    const arr = txs.filter((t) => t.transaction_date.startsWith(m.key));
    return {
      label: m.label,
      הכנסות: arr.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0),
      הוצאות: -arr.filter((t) => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0),
    };
  });

  const catMap = new Map(categories.map((c: any) => [c.id, c.name]));
  const byCat = new Map<string, number>();
  thisMonth.filter((t) => t.amount < 0).forEach((t) => {
    const name = t.category_id ? (catMap.get(t.category_id) ?? "ללא קטגוריה") : "ללא קטגוריה";
    byCat.set(name, (byCat.get(name) ?? 0) + Math.abs(Number(t.amount)));
  });
  const categoryData = Array.from(byCat.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  // balance per account
  const balByAcct = new Map<string, number>();
  txs.forEach((t) => balByAcct.set(t.account_id, (balByAcct.get(t.account_id) ?? 0) + Number(t.amount)));

  return (
    <AppShell title="לוח בקרה">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI title="הכנסות החודש" value={formatCurrency(income)} icon={TrendingUp} tone="income" />
          <KPI title="הוצאות החודש" value={formatCurrency(Math.abs(expense))} icon={TrendingDown} tone="expense" />
          <KPI title="מאזן החודש" value={formatCurrency(net)} icon={Scale} tone={net >= 0 ? "income" : "expense"} />
          <KPI title="יתרה כוללת" value={formatCurrency(total)} icon={Wallet} tone="primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>הכנסות מול הוצאות (12 חודשים)</CardTitle></CardHeader>
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
            <CardHeader><CardTitle>פילוח הוצאות החודש</CardTitle></CardHeader>
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
          <CardHeader><CardTitle>יתרה לפי חשבון</CardTitle></CardHeader>
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
