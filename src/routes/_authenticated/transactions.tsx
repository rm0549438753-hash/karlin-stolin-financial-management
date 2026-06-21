import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Download, Search, Upload, AlertTriangle, History, Undo2, X } from "lucide-react";
import { useAccounts, useCategories, useFunds, useExpenseTypes, useSubcategories, type Account } from "@/hooks/use-lookups";
import { formatDate } from "@/lib/format";
import { TransactionDialog, type TransactionRow } from "@/components/TransactionDialog";
import { ImportDialog } from "@/components/ImportDialog";
import { BulkEditDialog } from "@/components/BulkEditDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/transactions")({
  validateSearch: (s: Record<string, unknown>) => ({
    account: typeof s.account === "string" ? s.account : undefined,
    uncategorized: s.uncategorized === true || s.uncategorized === "true" ? true : undefined,
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
  fundMap: Map<string, string>;
  expMap: Map<string, string>;
  catMap: Map<string, string>;
  subMap: Map<string, string>;
};

const fmtNum = (v: any) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function UncatBadge() {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-dashed border-amber-300">לא מסווג</span>;
}

const COMMON_LOOKUPS: ColumnDef[] = [
  { header: "קופה", render: (r, c) => (r.fund_id ? c.fundMap.get(r.fund_id) : (!r.fund_id && !r.expense_type_id) ? <UncatBadge /> : "") },
  { header: "סוג", render: (r, c) => (r.expense_type_id ? c.expMap.get(r.expense_type_id) : (!r.fund_id && !r.expense_type_id) ? <UncatBadge /> : "") },
  { header: "קטגוריה", render: (r, c) => (r.category_id ? c.catMap.get(r.category_id) : "") },
  { header: "תת קטגוריה", render: (r, c) => (r.subcategory_id ? c.subMap.get(r.subcategory_id) : "") },
  { header: "הערה", render: (r) => r.note ?? "" },
];

const COLUMNS_BY_SCHEMA: Record<SchemaType, ColumnDef[]> = {
  mercantile: [
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    { header: "יום ערך", render: (r) => (r.value_date ? formatDate(r.value_date) : "") },
    { header: "תיאור התנועה", render: (r) => r.description ?? "" },
    { header: "אסמכתה", render: (r) => r.reference ?? "" },
    { header: "זכות", align: "left", render: (r) => <span className="text-income font-semibold tabular-nums">{fmtNum(r.credit)}</span> },
    { header: "חובה", align: "left", render: (r) => <span className="text-expense font-semibold tabular-nums">{fmtNum(r.debit)}</span> },
    { header: "₪ יתרה", align: "left", render: (r) => <span className="tabular-nums">{fmtNum(r.balance)}</span> },
    { header: "עמלה", align: "left", render: (r) => fmtNum(r.fee) },
    { header: "ערוץ ביצוע", render: (r) => r.channel ?? "" },
    ...COMMON_LOOKUPS,
  ],
  pagi: [
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    { header: "תאריך ערך", render: (r) => (r.value_date ? formatDate(r.value_date) : "") },
    { header: "תאור", render: (r) => r.description ?? "" },
    { header: "אסמכתא", render: (r) => r.reference ?? "" },
    { header: "סוג פעולה", render: (r) => r.operation_type ?? "" },
    { header: "זכות", align: "left", render: (r) => <span className="text-income font-semibold tabular-nums">{fmtNum(r.credit)}</span> },
    { header: "חובה", align: "left", render: (r) => <span className="text-expense font-semibold tabular-nums">{fmtNum(r.debit)}</span> },
    { header: "יתרה", align: "left", render: (r) => <span className="tabular-nums">{fmtNum(r.balance)}</span> },
    ...COMMON_LOOKUPS,
  ],
  checks: [
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    { header: "תאריך ערך", render: (r) => (r.value_date ? formatDate(r.value_date) : "") },
    { header: "שם", render: (r) => r.payee ?? "" },
    { header: "עמותה", render: (r) => r.association ?? "" },
    { header: "סכום", align: "left", render: (r) => <span className="font-semibold tabular-nums">{fmtNum(r.amount)}</span> },
    { header: "צ'ק עתידי", align: "center", render: (r) => (r.future_check === true ? "✓" : "") },
    ...COMMON_LOOKUPS,
  ],
  cash: [
    { header: "תאריך", render: (r) => formatDate(r.transaction_date) },
    { header: "פירוט", render: (r) => r.description ?? "" },
    { header: "סכום הכנסה", align: "left", render: (r) => <span className="text-income font-semibold tabular-nums">{fmtNum(r.credit)}</span> },
    { header: "סכום הוצאה", align: "left", render: (r) => <span className="text-expense font-semibold tabular-nums">{fmtNum(r.debit)}</span> },
    { header: "הערה", render: (r) => r.note ?? "" },
    { header: "קופה", render: (r, c) => (r.fund_id ? c.fundMap.get(r.fund_id) : (!r.fund_id && !r.expense_type_id) ? <UncatBadge /> : "") },
    { header: "סוג", render: (r, c) => (r.expense_type_id ? c.expMap.get(r.expense_type_id) : (!r.fund_id && !r.expense_type_id) ? <UncatBadge /> : "") },
    { header: "קטגוריה", render: (r, c) => (r.category_id ? c.catMap.get(r.category_id) : "") },
    { header: "תת קטגוריה", render: (r, c) => (r.subcategory_id ? c.subMap.get(r.subcategory_id) : "") },
  ],
};

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
  const [category, setCategory] = useState(ALL);
  const [subcategory, setSubcategory] = useState(ALL);
  const [fund, setFund] = useState(ALL);
  const [expType, setExpType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyUncat, setOnlyUncat] = useState<boolean>(urlSearch.uncategorized ?? false);

  useEffect(() => { setOnlyUncat(urlSearch.uncategorized ?? false); }, [urlSearch.uncategorized]);

  useEffect(() => {
    if (!urlSearch.account && accounts.length > 0) {
      navigate({ to: "/transactions", search: { account: accounts[0].id }, replace: true });
    }
  }, [urlSearch.account, accounts, navigate]);

  const account = urlSearch.account ?? "";
  const selectedAccount = useMemo(() => accounts.find((a) => a.id === account) ?? null, [accounts, account]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Reset selection + uncategorized filter when account changes (banner is per-account)
  useEffect(() => {
    setSelectedIds(new Set());
    setOnlyUncat(false);
    setSearch(""); setCategory(ALL); setSubcategory(ALL); setFund(ALL); setExpType(ALL); setFrom(""); setTo("");
  }, [account]);
  // Reset selection when filters change
  useEffect(() => { setSelectedIds(new Set()); }, [search, category, subcategory, fund, expType, from, to, onlyUncat]);



  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["transactions", { account, category, subcategory, fund, expType, from, to }],
    enabled: !!account,
    queryFn: async () => {
      let q = supabase.from("transactions").select("*").eq("account_id", account).order("transaction_date", { ascending: false }).limit(3000);
      if (category !== ALL) q = q.eq("category_id", category);
      if (subcategory !== ALL) q = q.eq("subcategory_id", subcategory);
      if (fund !== ALL) q = q.eq("fund_id", fund);
      if (expType !== ALL) q = q.eq("expense_type_id", expType);
      if (from) q = q.gte("transaction_date", from);
      if (to) q = q.lte("transaction_date", to);
      const { data, error } = await q;
      if (error) throw error;
      return data as TransactionRow[];
    },
  });

  const { data: uncatCount = 0 } = useQuery({
    queryKey: ["uncategorized-count", account],
    enabled: !!account,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("account_id", account)
        .is("fund_id", null)
        .is("expense_type_id", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["import-batches", account],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .eq("account_id", account)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const undoBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const { error: e1 } = await supabase.from("transactions").delete().eq("import_batch_id", batchId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("import_batches").delete().eq("id", batchId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("הייבוא בוטל");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה בביטול"),
  });

  const ctx: RenderCtx = useMemo(() => ({
    fundMap: new Map(funds.map((f) => [f.id, f.name])),
    expMap: new Map(expTypes.map((e) => [e.id, e.name])),
    catMap: new Map(categories.map((c) => [c.id, c.name])),
    subMap: new Map(subcats.map((s) => [s.id, s.name])),
  }), [funds, expTypes, categories, subcats]);

  const filtered = useMemo(() => {
    let r: any[] = rows;
    if (onlyUncat) r = r.filter((x) => !x.fund_id && !x.expense_type_id);
    if (!search.trim()) return r;
    const q = search.toLowerCase();
    return r.filter((x) =>
      (x.description ?? "").toLowerCase().includes(q) ||
      (x.reference ?? "").toLowerCase().includes(q) ||
      (x.note ?? "").toLowerCase().includes(q) ||
      (x.payee ?? "").toLowerCase().includes(q) ||
      (x.association ?? "").toLowerCase().includes(q),
    );
  }, [rows, search, onlyUncat]);

  const columns: ColumnDef[] = selectedAccount ? COLUMNS_BY_SCHEMA[selectedAccount.schema_type] : [];

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const r of filtered as any[]) {
      const a = Number(r.amount) || (Number(r.credit) || 0) - (Number(r.debit) || 0);
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
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} תנועות נמחקו`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["tx-dashboard"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  // Selection state derived from current filtered view
  const filteredIds = useMemo(() => filtered.map((r: any) => r.id as string), [filtered]);
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

  function exportRows(list: any[], filename: string) {
    const headers = columns.map((c) => c.header);
    const rowsCsv = list.map((r) => columns.map((col) => {
      const v = col.render(r as any, ctx);
      return typeof v === "string" || typeof v === "number" ? String(v) : "";
    }));
    const csv = [headers, ...rowsCsv].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click(); URL.revokeObjectURL(url);
  }
  function exportCSV() {
    exportRows(filtered, `transactions_${new Date().toISOString().slice(0, 10)}.csv`);
  }
  function exportSelected() {
    const list = filtered.filter((r: any) => selectedIds.has(r.id));
    exportRows(list, `transactions_selected_${new Date().toISOString().slice(0, 10)}.csv`);
  }


  const title = selectedAccount ? selectedAccount.name : "תנועות";

  return (
    <AppShell
      title={title}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!selectedAccount}>
            <Download className="w-4 h-4 ml-1" />ייצוא
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={!selectedAccount}>
                <History className="w-4 h-4 ml-1" />ייבואים אחרונים
              </Button>
            </PopoverTrigger>
            <PopoverContent dir="rtl" className="w-80 p-0">
              <div className="px-3 py-2 text-sm font-semibold border-b">היסטוריית ייבואים</div>
              {batches.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">אין ייבואים</div>
              ) : (
                <ul className="max-h-80 overflow-auto divide-y">
                  {batches.map((b: any) => (
                    <li key={b.id} className="p-3 flex items-start justify-between gap-2 hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{b.file_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(b.created_at).toLocaleString("he-IL")} · {b.row_count} שורות
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive shrink-0" onClick={() => { if (confirm("לבטל ייבוא זה ולמחוק את כל התנועות שלו?")) undoBatch.mutate(b.id); }}>
                        <Undo2 className="w-3.5 h-3.5 ml-1" />בטל
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={!selectedAccount}>
            <Upload className="w-4 h-4 ml-1" />ייבוא קובץ
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!selectedAccount}>
            <Plus className="w-4 h-4 ml-1" />תנועה חדשה
          </Button>
        </>
      }
    >
      {!selectedAccount ? (
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">בחר חשבון מהתפריט הצדדי כדי להציג תנועות.</div>
      ) : (
        <div className="space-y-4">
          {uncatCount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-amber-200 grid place-items-center text-amber-800 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <p className="text-sm text-amber-900 font-medium truncate">
                  ישנן <b>{uncatCount}</b> תנועות שטרם סווגו לקופה או לסוג בחשבון זה
                </p>
              </div>
              <button
                className="text-sm font-bold text-amber-800 hover:underline shrink-0"
                onClick={() => setOnlyUncat((v) => !v)}
              >
                {onlyUncat ? "הצג הכל" : "הצג רק לא מסווגות ←"}
              </button>
            </div>
          )}

          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש בתיאור / אסמכתה / הערה / שם" className="pr-9 bg-card" />
              </div>
              <FilterSelect value={category} onValueChange={setCategory} placeholder="כל הקטגוריות" items={categories} />
              <FilterSelect value={fund} onValueChange={setFund} placeholder="כל הקופות" items={funds} />
              <FilterSelect value={expType} onValueChange={setExpType} placeholder="כל הסוגים" items={expTypes} />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="w-[150px] bg-card" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="w-[150px] bg-card" />
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategory(ALL); setFund(ALL); setExpType(ALL); setFrom(""); setTo(""); setOnlyUncat(false); }}>איפוס</Button>
            </div>


            {selectedIds.size > 0 && (
              <div className="px-4 py-2.5 bg-primary/10 border-y border-primary/30 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Checkbox checked={true} onCheckedChange={() => setSelectedIds(new Set())} />
                  נבחרו {selectedIds.size} תנועות
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => setBulkEditOpen(true)}>
                    <Pencil className="w-3.5 h-3.5 ml-1" />שינוי נבחרות
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportSelected}>
                    <Download className="w-3.5 h-3.5 ml-1" />ייצוא נבחרות
                  </Button>
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
                    <TableHead className="w-10 px-3 border-l border-border">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="בחר הכל"
                      />
                    </TableHead>
                    {columns.map((c) => (
                      <TableHead
                        key={c.header}
                        className={
                          "text-xs font-bold uppercase tracking-wider text-muted-foreground border-l border-border last:border-l-0 px-4 py-3 " +
                          (c.align === "left" ? "text-left" : c.align === "center" ? "text-center" : "text-right")
                        }
                      >
                        {c.header}
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-24 border-l border-border last:border-l-0 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={columns.length + 2} className="text-center py-10 text-muted-foreground">טוען…</TableCell></TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={columns.length + 2} className="text-center py-12 text-muted-foreground">אין תנועות להצגה</TableCell></TableRow>
                  )}
                  {filtered.map((r, idx) => {
                    const isUncat = !r.fund_id && !r.expense_type_id;
                    const isChecked = selectedIds.has(r.id);
                    return (
                      <TableRow
                        key={r.id}
                        className={
                          "group border-b border-border transition-colors hover:bg-primary/5 " +
                          (isChecked ? "bg-primary/5 " : isUncat ? "bg-amber-50/30 " : idx % 2 ? "bg-muted/20 " : "")
                        }
                      >
                        <TableCell className="px-3 border-l border-border/60">
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleOne(r.id)} aria-label="בחר תנועה" />
                        </TableCell>
                        {columns.map((col) => (
                          <TableCell
                            key={col.header}
                            className={
                              "border-l border-border/60 last:border-l-0 px-4 py-3 text-sm align-middle " +
                              (col.align === "left" ? "text-left whitespace-nowrap " : col.align === "center" ? "text-center " : "text-right ") +
                              "max-w-[260px] truncate"
                            }
                          >
                            {col.render(r as any, ctx)}
                          </TableCell>
                        ))}
                        <TableCell className="border-l border-border/60 last:border-l-0 px-2 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {role?.isAdmin && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
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

            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/30 text-sm">
              <div>סך תנועות: <b>{totals.count}</b></div>
              <div className="flex gap-4">
                <span>הכנסות: <b className="text-income tabular-nums">{fmtNum(totals.inc)} ₪</b></span>
                <span>הוצאות: <b className="text-expense tabular-nums">{fmtNum(Math.abs(totals.exp))} ₪</b></span>
                <span>מאזן: <b className={(totals.net >= 0 ? "text-income " : "text-expense ") + "tabular-nums"}>{fmtNum(totals.net)} ₪</b></span>
              </div>
            </div>
          </div>
        </div>
      )}

      <TransactionDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }} initial={editing} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} account={selectedAccount} />
      <BulkEditDialog open={bulkEditOpen} onOpenChange={setBulkEditOpen} ids={Array.from(selectedIds)} onDone={() => setSelectedIds(new Set())} />

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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק {selectedIds.size} תנועות?</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו אינה הפיכה ותמחק את כל התנועות שנבחרו.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={() => { bulkDel.mutate(Array.from(selectedIds)); setBulkDeleteOpen(false); }} className="bg-destructive text-destructive-foreground">מחיקה</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function FilterSelect({ value, onValueChange, placeholder, items }: { value: string; onValueChange: (v: string) => void; placeholder: string; items: { id: string; name: string }[] }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[160px] bg-card"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
