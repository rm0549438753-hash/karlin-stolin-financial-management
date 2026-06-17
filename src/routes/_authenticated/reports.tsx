import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAccounts, useCategories, useFunds } from "@/hooks/use-lookups";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type Tx = {
  id: string;
  transaction_date: string;
  amount: number;
  account_id: string;
  category_id: string | null;
  fund_id: string | null;
  description: string | null;
};

function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const [from, setFrom] = useState(yearAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [threshold, setThreshold] = useState(10000);

  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: funds = [] } = useFunds();

  const { data: txs = [] } = useQuery({
    queryKey: ["tx-reports", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_date, amount, account_id, category_id, fund_id, description")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data as Tx[];
    },
  });

  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const totals = useMemo(() => {
    const inc = txs.filter((t) => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0);
    const exp = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Number(t.amount), 0);
    return { inc, exp, net: inc + exp };
  }, [txs]);

  // breakdown by category
  const byCategory = useMemo(() => {
    const map = new Map<string, { inc: number; exp: number }>();
    txs.forEach((t) => {
      const name = t.category_id ? catMap.get(t.category_id) ?? "ללא קטגוריה" : "ללא קטגוריה";
      const e = map.get(name) ?? { inc: 0, exp: 0 };
      if (t.amount >= 0) e.inc += Number(t.amount); else e.exp += Number(t.amount);
      map.set(name, e);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v, net: v.inc + v.exp, abs: Math.abs(v.inc) + Math.abs(v.exp) }))
      .sort((a, b) => b.abs - a.abs);
  }, [txs, catMap]);

  // pivot: rows = category, cols = month
  const months = useMemo(() => {
    const set = new Set<string>();
    txs.forEach((t) => set.add(t.transaction_date.slice(0, 7)));
    return Array.from(set).sort();
  }, [txs]);
  const pivot = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    txs.forEach((t) => {
      const name = t.category_id ? catMap.get(t.category_id) ?? "ללא קטגוריה" : "ללא קטגוריה";
      const m = t.transaction_date.slice(0, 7);
      if (!map.has(name)) map.set(name, new Map());
      const row = map.get(name)!;
      row.set(m, (row.get(m) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "he"));
  }, [txs, catMap]);

  // accounts vs months pivot
  const acctPivot = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    txs.forEach((t) => {
      const name = acctMap.get(t.account_id) ?? "—";
      const m = t.transaction_date.slice(0, 7);
      if (!map.has(name)) map.set(name, new Map());
      const row = map.get(name)!;
      row.set(m, (row.get(m) ?? 0) + Number(t.amount));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "he"));
  }, [txs, acctMap]);

  // anomalies
  const highValue = txs.filter((t) => Math.abs(Number(t.amount)) >= threshold).slice(0, 50);
  const uncategorized = txs.filter((t) => !t.category_id).slice(0, 50);

  return (
    <AppShell title="דוחות">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">מתאריך</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">עד תאריך</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1 mr-auto">
              <Label className="text-xs">סף חריגה (₪)</Label>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} dir="ltr" className="w-32" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard title="הכנסות" value={formatCurrency(totals.inc)} tone="income" />
          <SummaryCard title="הוצאות" value={formatCurrency(Math.abs(totals.exp))} tone="expense" />
          <SummaryCard title="מאזן" value={formatCurrency(totals.net)} tone={totals.net >= 0 ? "income" : "expense"} />
        </div>

        <Tabs defaultValue="categories">
          <TabsList>
            <TabsTrigger value="categories">פילוח קטגוריות</TabsTrigger>
            <TabsTrigger value="pivot-cat">פיבוט קטגוריה × חודש</TabsTrigger>
            <TabsTrigger value="pivot-acct">פיבוט חשבון × חודש</TabsTrigger>
            <TabsTrigger value="anomalies">חריגות והתראות</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">קטגוריה</TableHead>
                  <TableHead className="text-left">הכנסות</TableHead>
                  <TableHead className="text-left">הוצאות</TableHead>
                  <TableHead className="text-left">מאזן</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {byCategory.map((c, idx) => (
                    <TableRow key={c.name} className={idx % 2 ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-left font-mono text-income">{formatCurrency(c.inc)}</TableCell>
                      <TableCell className="text-left font-mono text-expense">{formatCurrency(Math.abs(c.exp))}</TableCell>
                      <TableCell className={`text-left font-mono font-semibold ${c.net >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(c.net)}</TableCell>
                    </TableRow>
                  ))}
                  {byCategory.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">אין נתונים</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="pivot-cat">
            <Card><CardContent className="p-0 overflow-x-auto">
              <PivotTable months={months} rows={pivot} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="pivot-acct">
            <Card><CardContent className="p-0 overflow-x-auto">
              <PivotTable months={months} rows={acctPivot} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="anomalies">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />תנועות חורגות (≥ {formatCurrency(threshold)})</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <AnomalyTable rows={highValue} acctMap={acctMap} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />תנועות לא מקוטלגות</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <AnomalyTable rows={uncategorized} acctMap={acctMap} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone: "income" | "expense" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`text-2xl font-bold ${tone === "income" ? "text-income" : "text-expense"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function PivotTable({ months, rows }: { months: string[]; rows: [string, Map<string, number>][] }) {
  if (rows.length === 0) return <div className="p-8 text-center text-muted-foreground">אין נתונים</div>;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="text-right sticky right-0 bg-card z-10">שם</TableHead>
        {months.map((m) => <TableHead key={m} className="text-left whitespace-nowrap">{m}</TableHead>)}
        <TableHead className="text-left font-bold">סה"כ</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map(([name, vals], idx) => {
          const total = Array.from(vals.values()).reduce((s, v) => s + v, 0);
          return (
            <TableRow key={name} className={idx % 2 ? "bg-muted/30" : ""}>
              <TableCell className="font-medium sticky right-0 bg-inherit">{name}</TableCell>
              {months.map((m) => {
                const v = vals.get(m) ?? 0;
                return <TableCell key={m} className={`text-left font-mono text-xs ${v > 0 ? "text-income" : v < 0 ? "text-expense" : "text-muted-foreground"}`}>{v ? formatCurrency(v) : "—"}</TableCell>;
              })}
              <TableCell className={`text-left font-mono font-bold ${total >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(total)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function AnomalyTable({ rows, acctMap }: { rows: Tx[]; acctMap: Map<string, string> }) {
  if (rows.length === 0) return <div className="p-8 text-center text-muted-foreground">לא נמצאו</div>;
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead className="text-right">תאריך</TableHead>
        <TableHead className="text-right">חשבון</TableHead>
        <TableHead className="text-right">תיאור</TableHead>
        <TableHead className="text-left">סכום</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap text-xs">{r.transaction_date}</TableCell>
            <TableCell className="text-xs truncate max-w-[120px]">{acctMap.get(r.account_id)}</TableCell>
            <TableCell className="text-xs truncate max-w-[180px]">{r.description || "—"}</TableCell>
            <TableCell className={`text-left font-mono text-xs ${r.amount >= 0 ? "text-income" : "text-expense"}`}>{formatCurrency(Number(r.amount))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
