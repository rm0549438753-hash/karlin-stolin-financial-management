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
import { Plus, Pencil, Trash2, Download, Search, Filter } from "lucide-react";
import { useAccounts, useCategories, useFunds, useExpenseTypes, useSubcategories, type Account } from "@/hooks/use-lookups";
import { formatDate } from "@/lib/format";
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

type SchemaType = Account["schema_type"];

type ColumnDef = {
  header: string;
  align?: "right" | "left" | "center";
  render: (r: TransactionRow & Record<string, any>, ctx: RenderCtx) => React.ReactNode;
};

type RenderCtx = {
  acctMap: Map<string, string>;
  fundMap: Map<string, string>;
  expMap: Map<string, string>;
  catMap: Map<string, string>;
  subMap: Map<string, string>;
};

const fmtNum = (v: any) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const COMMON_LOOKUPS: ColumnDef[] = [
  { header: "קופה", render: (r, c) => (r.fund_id ? c.fundMap.get(r.fund_id) : "") },
  { header: "סוג", render: (r, c) => (r.expense_type_id ? c.expMap.get(r.expense_type_id) : "") },
  { header: "קטגוריה", render: (r, c) => (r.category_id ? c.catMap.get(r.category_id) : "") },
  { header: "תת קטגוריה", render: (r, c) => (r.subcategory_id ? c.subMap.get(r.subcategory_id) : "") },
  { header: "הערה", render: (r) => r.note ?? "" },
];

const COLUMNS_BY_SCHEMA: Record<SchemaType, ColumnDef[]> = {
  mercantile: [
    { header: "זכות", align: "left", render: (r) => fmtNum(r.credit) },
    { header: "חובה", align: "left", render: (r) => fmtNum(r.debit) },
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    { header: "יום ערך", render: (r) => (r.value_date ? formatDate(r.value_date) : "") },
    { header: "תיאור התנועה", render: (r) => r.description ?? "" },
    { header: "₪ זכות/חובה", align: "left", render: (r) => fmtNum(r.amount) },
    { header: "₪ יתרה", align: "left", render: (r) => fmtNum(r.balance) },
    { header: "אסמכתה", render: (r) => r.reference ?? "" },
    { header: "עמלה", align: "left", render: (r) => fmtNum(r.fee) },
    { header: "ערוץ ביצוע", render: (r) => r.channel ?? "" },
    ...COMMON_LOOKUPS,
  ],
  pagi: [
    { header: "יתרה", align: "left", render: (r) => fmtNum(r.balance) },
    { header: "תאריך ערך", render: (r) => (r.value_date ? formatDate(r.value_date) : "") },
    { header: "זכות", align: "left", render: (r) => fmtNum(r.credit) },
    { header: "חובה", align: "left", render: (r) => fmtNum(r.debit) },
    { header: "תאור", render: (r) => r.description ?? "" },
    { header: "אסמכתא", render: (r) => r.reference ?? "" },
    { header: "סוג פעולה", render: (r) => r.operation_type ?? "" },
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    ...COMMON_LOOKUPS,
  ],
  checks: [
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    { header: "עמותה", render: (r) => r.association ?? "" },
    { header: "סכום", align: "left", render: (r) => fmtNum(r.amount) },
    { header: "שם", render: (r) => r.payee ?? "" },
    { header: "תאריך ערך", render: (r) => (r.value_date ? formatDate(r.value_date) : "") },
    ...COMMON_LOOKUPS,
    { header: "צ'ק עתידי ?", align: "center", render: (r) => (r.future_check === true ? "✓" : r.future_check === false ? "—" : "") },
  ],
  cash: [
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    { header: "פירוט", render: (r) => r.description ?? "" },
    { header: "סכום הוצאה", align: "left", render: (r) => fmtNum(r.debit) },
    { header: "סכום הכנסה", align: "left", render: (r) => fmtNum(r.credit) },
    { header: "הערה", render: (r) => r.note ?? "" },
    { header: "קופה", render: (r, c) => (r.fund_id ? c.fundMap.get(r.fund_id) : "") },
    { header: "סוג", render: (r, c) => (r.expense_type_id ? c.expMap.get(r.expense_type_id) : "") },
    { header: "קטגוריה", render: (r, c) => (r.category_id ? c.catMap.get(r.category_id) : "") },
    { header: "תת קטגוריה", render: (r, c) => (r.subcategory_id ? c.subMap.get(r.subcategory_id) : "") },
  ],
};

const ALL_COLUMNS: ColumnDef[] = [
  { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
  { header: "חשבון", render: (r, c) => c.acctMap.get(r.account_id) ?? "" },
  { header: "תיאור", render: (r) => r.description ?? r.association ?? "" },
  { header: "אסמכתה", render: (r) => r.reference ?? "" },
  { header: "זכות", align: "left", render: (r) => fmtNum(r.credit) },
  { header: "חובה", align: "left", render: (r) => fmtNum(r.debit) },
  { header: "סכום", align: "left", render: (r) => fmtNum(r.amount) },
  ...COMMON_LOOKUPS,
];

function TransactionsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const urlSearch = useSearch({ from: "/_authenticated/transactions" });
  const { data: role } = useUserRole();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: funds = [] } = useFunds();
  const { data: expTypes = [] } = useExpenseTypes();
  const { data: subcats = [] } = useSubcategories();

  const [search, setSearch] = useState("");
  const [account, setAccount] = useState<string>(urlSearch.account ?? ALL);
  const [category, setCategory] = useState(ALL);
  const [fund, setFund] = useState(ALL);
  const [expType, setExpType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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
      let q = supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).limit(3000);
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

  const ctx: RenderCtx = useMemo(() => ({
    acctMap: new Map(accounts.map((a) => [a.id, a.name])),
    fundMap: new Map(funds.map((f) => [f.id, f.name])),
    expMap: new Map(expTypes.map((e) => [e.id, e.name])),
    catMap: new Map(categories.map((c) => [c.id, c.name])),
    subMap: new Map(subcats.map((s) => [s.id, s.name])),
  }), [accounts, funds, expTypes, categories, subcats]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      (r.description ?? "").toLowerCase().includes(q) ||
      (r.reference ?? "").toLowerCase().includes(q) ||
      (r.note ?? "").toLowerCase().includes(q) ||
      (r.payee ?? "").toLowerCase().includes(q) ||
      (r.association ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const selectedAccount = useMemo(() => accounts.find((a) => a.id === account), [accounts, account]);
  const columns: ColumnDef[] = selectedAccount ? COLUMNS_BY_SCHEMA[selectedAccount.schema_type] : ALL_COLUMNS;

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const r of filtered as any[]) {
      const a = Number(r.amount) || 0;
      if (a > 0) inc += a; else exp += a;
    }
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
    const headers = columns.map((c) => c.header);
    const rowsCsv = filtered.map((r) => columns.map((col) => {
      const v = col.render(r as any, ctx);
      return typeof v === "string" || typeof v === "number" ? String(v) : "";
    }));
    const csv = [headers, ...rowsCsv].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const title = selectedAccount ? selectedAccount.name : "כל התנועות";

  return (
    <AppShell
      title={title}
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
                    {columns.map((c) => (
                      <TableHead key={c.header} className={c.align === "left" ? "text-left" : c.align === "center" ? "text-center" : "text-right"}>
                        {c.header}
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-24">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-10 text-muted-foreground">טוען…</TableCell></TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">אין תנועות להצגה</TableCell></TableRow>
                  )}
                  {filtered.map((r, idx) => (
                    <TableRow key={r.id} className={idx % 2 ? "bg-muted/30" : ""}>
                      {columns.map((col) => (
                        <TableCell
                          key={col.header}
                          className={
                            (col.align === "left" ? "text-left font-mono whitespace-nowrap " : col.align === "center" ? "text-center " : "text-right ") +
                            "max-w-[260px] truncate"
                          }
                        >
                          {col.render(r as any, ctx)}
                        </TableCell>
                      ))}
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
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t bg-muted/30 text-sm">
              <div>סך תנועות: <b>{totals.count}</b></div>
              <div className="flex gap-4">
                <span>הכנסות: <b className="text-income">{fmtNum(totals.inc)} ₪</b></span>
                <span>הוצאות: <b className="text-expense">{fmtNum(Math.abs(totals.exp))} ₪</b></span>
                <span>מאזן: <b className={totals.net >= 0 ? "text-income" : "text-expense"}>{fmtNum(totals.net)} ₪</b></span>
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
