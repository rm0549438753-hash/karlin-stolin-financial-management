import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Download, Search, Filter } from "lucide-react";
import { useAccounts, useCategories, useFunds, useExpenseTypes } from "@/hooks/use-lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { TransactionDialog, type TransactionRow } from "@/components/TransactionDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/transactions")({
  validateSearch: (s: Record<string, unknown>) => ({
    account: typeof s.account === "string" ? s.account : undefined,
  }),
  component: TransactionsPage,
});

const ALL = "__all__";

function TransactionsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const urlSearch = useSearch({ from: "/_authenticated/transactions" });
  const { data: role } = useUserRole();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: funds = [] } = useFunds();
  const { data: expTypes = [] } = useExpenseTypes();

  const [search, setSearch] = useState("");
  const [account, setAccount] = useState<string>(urlSearch.account ?? ALL);
  const [category, setCategory] = useState(ALL);
  const [fund, setFund] = useState(ALL);
  const [expType, setExpType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Sync local filter ↔ URL when sidebar links change the search param
  useEffect(() => {
    const next = urlSearch.account ?? ALL;
    setAccount((prev) => (prev === next ? prev : next));
  }, [urlSearch.account]);

  function changeAccount(v: string) {
    setAccount(v);
    navigate({
      to: "/transactions",
      search: v === ALL ? {} : { account: v },
      replace: true,
    });
  }


  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions", { account, category, fund, expType, from, to }],
    queryFn: async () => {
      let q = supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).limit(2000);
      if (account !== ALL) q = q.eq("account_id", account);
      if (category !== ALL) q = q.eq("category_id", category);
      if (fund !== ALL) q = q.eq("fund_id", fund);
      if (expType !== ALL) q = q.eq("expense_type_id", expType);
      if (from) q = q.gte("transaction_date", from);
      if (to) q = q.lte("transaction_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return data as TransactionRow[];
    },
  });

  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const fundMap = useMemo(() => new Map(funds.map((f) => [f.id, f.name])), [funds]);
  const expMap = useMemo(() => new Map(expTypes.map((e) => [e.id, e.name])), [expTypes]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.reference ?? "").toLowerCase().includes(q) ||
      (r.note ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const inc = filtered.filter((r) => r.amount > 0).reduce((s, r) => s + Number(r.amount), 0);
    const exp = filtered.filter((r) => r.amount < 0).reduce((s, r) => s + Number(r.amount), 0);
    return { inc, exp, net: inc + exp, count: filtered.length };
  }, [filtered]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("התנועה נמחקה");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["tx-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  function exportCSV() {
    const headers = ["תאריך", "חשבון", "תיאור", "אסמכתה", "סכום", "קופה", "סוג", "קטגוריה", "הערה"];
    const rowsCsv = filtered.map((r) => [
      r.transaction_date,
      acctMap.get(r.account_id) ?? "",
      (r.description ?? "").replace(/[\r\n]+/g, " "),
      r.reference ?? "",
      Number(r.amount).toFixed(2),
      r.fund_id ? fundMap.get(r.fund_id) ?? "" : "",
      r.expense_type_id ? expMap.get(r.expense_type_id) ?? "" : "",
      r.category_id ? catMap.get(r.category_id) ?? "" : "",
      (r.note ?? "").replace(/[\r\n]+/g, " "),
    ]);
    const csv = [headers, ...rowsCsv].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="תנועות"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 ml-1" />ייצוא</Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 ml-1" />תנועה חדשה
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="w-4 h-4" /> סינון
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש בתיאור / אסמכתה / הערה" className="pr-9" />
              </div>
              <FilterSelect value={account} onValueChange={changeAccount} placeholder="כל החשבונות" items={accounts} />
              <FilterSelect value={category} onValueChange={setCategory} placeholder="כל הקטגוריות" items={categories} />
              <FilterSelect value={fund} onValueChange={setFund} placeholder="כל הקופות" items={funds} />
              <FilterSelect value={expType} onValueChange={setExpType} placeholder="כל הסוגים" items={expTypes} />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" placeholder="מתאריך" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" placeholder="עד תאריך" />
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); changeAccount(ALL); setCategory(ALL); setFund(ALL); setExpType(ALL); setFrom(""); setTo(""); }}>איפוס</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">חשבון</TableHead>
                    <TableHead className="text-right">תיאור</TableHead>
                    <TableHead className="text-right">קטגוריה</TableHead>
                    <TableHead className="text-right">קופה</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-left">סכום</TableHead>
                    <TableHead className="text-center w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">טוען…</TableCell></TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">אין תנועות להצגה</TableCell></TableRow>
                  )}
                  {filtered.map((r, idx) => {
                    const isInc = Number(r.amount) >= 0;
                    return (
                      <TableRow key={r.id} className={idx % 2 ? "bg-muted/30" : ""}>
                        <TableCell className="whitespace-nowrap">{formatDate(r.transaction_date)}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{acctMap.get(r.account_id)}</TableCell>
                        <TableCell className="max-w-[260px]">
                          <div className="truncate">{r.description || "—"}</div>
                          {r.reference && <div className="text-xs text-muted-foreground">{r.reference}</div>}
                        </TableCell>
                        <TableCell>{r.category_id ? catMap.get(r.category_id) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{r.fund_id ? fundMap.get(r.fund_id) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{r.expense_type_id ? expMap.get(r.expense_type_id) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-left font-mono font-semibold whitespace-nowrap">
                          <Badge variant="outline" className={isInc ? "border-income/30 text-income bg-income/5" : "border-expense/30 text-expense bg-expense/5"}>
                            {formatCurrency(Number(r.amount), true)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {role?.isAdmin && (
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(r.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t bg-muted/30 text-sm">
              <div>סך תנועות: <b>{totals.count}</b></div>
              <div className="flex gap-4">
                <span>הכנסות: <b className="text-income">{formatCurrency(totals.inc)}</b></span>
                <span>הוצאות: <b className="text-expense">{formatCurrency(Math.abs(totals.exp))}</b></span>
                <span>מאזן: <b className={totals.net >= 0 ? "text-income" : "text-expense"}>{formatCurrency(totals.net)}</b></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }} initial={editing} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את התנועה?</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) del.mutate(deleteId); setDeleteId(null); }} className="bg-destructive text-destructive-foreground">מחיקה</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function FilterSelect({ value, onValueChange, placeholder, items }: { value: string; onValueChange: (v: string) => void; placeholder: string; items: { id: string; name: string }[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
