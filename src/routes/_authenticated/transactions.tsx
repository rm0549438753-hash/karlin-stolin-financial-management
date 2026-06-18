import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Download, Search, Filter, Wallet } from "lucide-react";
import { useAccounts, useCategories, useFunds, useExpenseTypes, useSubcategories } from "@/hooks/use-lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { TransactionDialog, type TransactionRow } from "@/components/TransactionDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-auth";
import { columnsForKind, type ColumnDef } from "@/lib/account-templates";

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
  const { data: subs = [] } = useSubcategories();

  const accountId = urlSearch.account;
  const currentAccount = useMemo(() => accounts.find((a) => a.id === accountId), [accounts, accountId]);
  const columns = useMemo<ColumnDef[]>(
    () => (currentAccount ? columnsForKind(currentAccount.kind) : []),
    [currentAccount],
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [fund, setFund] = useState(ALL);
  const [expType, setExpType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Reset filters when switching accounts
  useEffect(() => {
    setSearch(""); setCategory(ALL); setFund(ALL); setExpType(ALL); setFrom(""); setTo("");
  }, [accountId]);

  const { data: rows = [], isLoading } = useQuery({
    enabled: !!accountId,
    queryKey: ["transactions", { accountId, category, fund, expType, from, to }],
    queryFn: async () => {
      let q = supabase.from("transactions").select("*").eq("account_id", accountId!).order("transaction_date", { ascending: false }).limit(2000);
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

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const fundMap = useMemo(() => new Map(funds.map((f) => [f.id, f.name])), [funds]);
  const expMap = useMemo(() => new Map(expTypes.map((e) => [e.id, e.name])), [expTypes]);
  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s.name])), [subs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.reference ?? "").toLowerCase().includes(q) ||
      (r.note ?? "").toLowerCase().includes(q) ||
      (r.payee ?? "").toLowerCase().includes(q) ||
      (r.payer_name ?? "").toLowerCase().includes(q),
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
    if (!currentAccount) return;
    const headers = columns.filter((c) => c.key !== "actions").map((c) => c.label);
    const rowsCsv = filtered.map((r) => columns.filter((c) => c.key !== "actions").map((c) => cellText(c.key, r)));
    const csv = [headers, ...rowsCsv].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${currentAccount.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function cellText(key: ColumnDef["key"], r: TransactionRow): string {
    const amt = Number(r.amount);
    switch (key) {
      case "transaction_date": return r.transaction_date ?? "";
      case "value_date": return r.value_date ?? "";
      case "description": return r.description ?? "";
      case "credit_debit":
      case "amount_signed": return amt.toFixed(2);
      case "debit": return amt < 0 ? Math.abs(amt).toFixed(2) : "";
      case "credit": return amt > 0 ? amt.toFixed(2) : "";
      case "balance": return r.balance == null ? "" : Number(r.balance).toFixed(2);
      case "reference": return r.reference ?? "";
      case "fee": return r.fee == null ? "" : Number(r.fee).toFixed(2);
      case "channel": return r.channel ?? "";
      case "operation_code": return r.operation_code ?? "";
      case "fund": return r.fund_id ? fundMap.get(r.fund_id) ?? "" : "";
      case "expense_type": return r.expense_type_id ? expMap.get(r.expense_type_id) ?? "" : "";
      case "category": return r.category_id ? catMap.get(r.category_id) ?? "" : "";
      case "subcategory": return r.subcategory_id ? subMap.get(r.subcategory_id) ?? "" : "";
      case "note": return r.note ?? "";
      case "payee": return r.payee ?? "";
      case "payer_name": return r.payer_name ?? "";
      default: return "";
    }
  }

  // Empty / no-account selected: show account picker
  if (!accountId) {
    return (
      <AppShell title="תנועות">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold mb-1">בחר חשבון</h2>
            <p className="text-sm text-muted-foreground mb-4">לכל חשבון יש מבנה עמודות משלו לפי סוג החשבון (בנק / מזומן / צ׳קים).</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {accounts.map((a) => (
                <Link
                  key={a.id}
                  to="/transactions"
                  search={{ account: a.id }}
                  className="group border rounded-lg p-4 hover:border-primary hover:bg-muted/30 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-muted-foreground">{kindLabel(a.kind)}</div>
                    </div>
                  </div>
                </Link>
              ))}
              {accounts.length === 0 && (
                <div className="text-sm text-muted-foreground">אין חשבונות מוגדרים.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const colCount = columns.length;

  return (
    <AppShell
      title={`תנועות · ${currentAccount?.name ?? ""}`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/transactions", search: {}, replace: true })}>
            ↺ חשבון אחר
          </Button>
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
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש…" className="pr-9" />
              </div>
              <FilterSelect value={category} onValueChange={setCategory} placeholder="כל הקטגוריות" items={categories} />
              <FilterSelect value={fund} onValueChange={setFund} placeholder="כל הקופות" items={funds} />
              <FilterSelect value={expType} onValueChange={setExpType} placeholder="כל הסוגים" items={expTypes} />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategory(ALL); setFund(ALL); setExpType(ALL); setFrom(""); setTo(""); }}>איפוס</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => (
                      <TableHead key={c.key} className={`${c.align === "left" ? "text-left" : c.align === "center" ? "text-center" : "text-right"} ${c.className ?? ""}`}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={colCount} className="text-center py-10 text-muted-foreground">טוען…</TableCell></TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground">אין תנועות להצגה</TableCell></TableRow>
                  )}
                  {filtered.map((r, idx) => (
                    <TableRow key={r.id} className={idx % 2 ? "bg-muted/30" : ""}>
                      {columns.map((c) => (
                        <TableCell key={c.key} className={c.align === "left" ? "text-left whitespace-nowrap" : c.align === "center" ? "text-center" : ""}>
                          {renderCell(c.key, r)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
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

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        initial={editing}
        defaultAccount={accountId}
      />

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

  function renderCell(key: ColumnDef["key"], r: TransactionRow) {
    const amt = Number(r.amount);
    const isInc = amt >= 0;
    switch (key) {
      case "transaction_date": return <span className="whitespace-nowrap">{formatDate(r.transaction_date)}</span>;
      case "value_date": return r.value_date ? <span className="whitespace-nowrap">{formatDate(r.value_date)}</span> : dash();
      case "description":
        return (
          <div className="max-w-[260px]">
            <div className="truncate">{r.description || "—"}</div>
          </div>
        );
      case "credit_debit":
      case "amount_signed":
        return (
          <span className={`font-mono font-semibold ${isInc ? "text-income" : "text-expense"}`}>
            {formatCurrency(amt, true)}
          </span>
        );
      case "debit":
        return amt < 0
          ? <span className="font-mono font-semibold text-expense">{formatCurrency(Math.abs(amt), true)}</span>
          : dash();
      case "credit":
        return amt > 0
          ? <span className="font-mono font-semibold text-income">{formatCurrency(amt, true)}</span>
          : dash();
      case "balance": return r.balance == null ? dash() : <span className="font-mono">{formatCurrency(Number(r.balance), true)}</span>;
      case "reference": return r.reference ? <span className="font-mono text-xs">{r.reference}</span> : dash();
      case "fee": return r.fee == null ? dash() : <span className="font-mono">{formatCurrency(Number(r.fee), true)}</span>;
      case "channel": return r.channel || dash();
      case "operation_code": return r.operation_code ? <span className="font-mono text-xs">{r.operation_code}</span> : dash();
      case "fund": return r.fund_id ? fundMap.get(r.fund_id) : dash();
      case "expense_type": return r.expense_type_id ? expMap.get(r.expense_type_id) : dash();
      case "category": return r.category_id ? catMap.get(r.category_id) : dash();
      case "subcategory": return r.subcategory_id ? subMap.get(r.subcategory_id) : dash();
      case "note": return r.note ? <span className="text-xs">{r.note}</span> : dash();
      case "payee": return r.payee || dash();
      case "payer_name": return r.payer_name || dash();
      case "actions":
        return (
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
        );
      default:
        return null;
    }
  }
}

function dash() { return <span className="text-muted-foreground">—</span>; }

function kindLabel(kind: string) {
  switch (kind) {
    case "mercantile": return "חשבון בנק · מרכנתיל";
    case "pagi": return "חשבון בנק · פאגי";
    case "cash": return "מזומן";
    case "checks": return "צ׳קים";
    default: return kind || "חשבון";
  }
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
