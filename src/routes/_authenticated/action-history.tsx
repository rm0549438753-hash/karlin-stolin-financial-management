import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAccounts, useCategories, useExpenseTypes, useFunds, useSubcategories } from "@/hooks/use-lookups";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/action-history")({
  component: ActionHistoryPage,
});

type HistoryAction = "insert" | "update" | "delete";

type ActionHistoryRow = {
  id: string;
  table_name: string;
  record_id: string;
  action: HistoryAction;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  actor_id: string | null;
  undone_at: string | null;
  undone_by: string | null;
  created_at: string;
};

const TABLE_LABELS: Record<string, string> = {
  transactions: "תנועות",
  accounts: "חשבונות",
  funds: "קופות",
  expense_types: "סוגים",
  categories: "קטגוריות",
  subcategories: "תתי קטגוריות",
};

const ACTION_LABELS: Record<HistoryAction, string> = {
  insert: "הוספה",
  update: "עריכה",
  delete: "מחיקה",
};

const ALLOWED_UNDO_TABLES = new Set(Object.keys(TABLE_LABELS));
const HIDDEN_DETAIL_FIELDS = new Set(["id", "created_at", "updated_at", "created_by", "updated_by", "import_batch_id"]);
const PAGE_SIZE = 50;

async function fetchActionHistoryPage(pageParam: number, fromDate: string, toDate: string): Promise<ActionHistoryRow[]> {
  let q = (supabase as any)
    .from("action_history")
    .select("id, table_name, record_id, action, old_data, new_data, actor_id, undone_at, undone_by, created_at")
    .order("created_at", { ascending: false })
    .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1);
  if (fromDate) q = q.gte("created_at", `${fromDate}T00:00:00`);
  if (toDate) q = q.lte("created_at", `${toDate}T23:59:59.999`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ActionHistoryRow[];
}

function ActionHistoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pendingUndo, setPendingUndo] = useState<ActionHistoryRow | null>(null);

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["action-history", fromDate, toDate],
    queryFn: ({ pageParam = 0 }) => fetchActionHistoryPage(pageParam as number, fromDate, toDate),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < PAGE_SIZE ? undefined : allPages.length),
  });

  const rows = useMemo(() => (data?.pages ?? []).flat(), [data]);

  const actorIds = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((r) => { if (r.actor_id) ids.add(r.actor_id); if (r.undone_by) ids.add(r.undone_by); });
    return Array.from(ids).sort();
  }, [rows]);

  const { data: actorNames } = useQuery({
    queryKey: ["actor-names", actorIds],
    enabled: actorIds.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("actor_names", { _ids: actorIds });
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((p: any) => map.set(p.id, p.full_name ?? ""));
      return map;
    },
  });

  const actorLabel = (id: string | null) => (id ? (actorNames?.get(id) || "משתמש לא ידוע") : "מערכת");

  const { data: accounts = [] } = useAccounts();
  const { data: funds = [] } = useFunds();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();

  const lookupMaps = useMemo(() => ({
    account_id: new Map(accounts.map((x: any) => [x.id, x.name])),
    fund_id: new Map(funds.map((x: any) => [x.id, x.name])),
    expense_type_id: new Map(expenseTypes.map((x: any) => [x.id, x.name])),
    category_id: new Map(categories.map((x: any) => [x.id, x.name])),
    subcategory_id: new Map(subcategories.map((x: any) => [x.id, x.name])),
  }), [accounts, funds, expenseTypes, categories, subcategories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [
      TABLE_LABELS[row.table_name] ?? row.table_name,
      ACTION_LABELS[row.action],
      describeRecord(row),
      row.created_at,
      row.record_id,
    ].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [rows, search]);

  const undoMutation = useMutation({
    mutationFn: async (row: ActionHistoryRow) => {
      if (!ALLOWED_UNDO_TABLES.has(row.table_name)) throw new Error("לא ניתן לבטל פעולה מסוג זה");
      if (row.undone_at) throw new Error("הפעולה כבר בוטלה");
      const { error } = await (supabase as any).rpc("undo_action_history", { p_history_id: row.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("השינוי בוטל");
      setPendingUndo(null);
      qc.invalidateQueries({ queryKey: ["action-history"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "לא ניתן לבטל את השינוי"),
  });

  const clearDates = () => { setFromDate(""); setToDate(""); };

  return (
    <AppShell title="היסטוריית פעולות">
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 flex flex-wrap gap-3 items-end border-b">
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-lg font-extrabold">היסטוריית שינויים</h2>
              <p className="text-xs text-muted-foreground">תנועות והגדרות פיננסיות שניתן לשחזר ככל שהנתונים עדיין תקינים.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">מתאריך</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-card w-[150px]" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">עד תאריך</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-card w-[150px]" />
              </div>
              {(fromDate || toDate) && (
                <Button variant="ghost" size="sm" onClick={clearDates} className="mb-0.5">
                  <X className="w-3.5 h-3.5 ml-1" />נקה
                </Button>
              )}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש בפעולות" className="pr-9 bg-card" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">זמן</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">פעולה</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">אזור</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">פרטים</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-l border-border px-2 py-2 whitespace-nowrap">סטטוס</TableHead>
                  <TableHead className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-2 whitespace-nowrap">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">טוען…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">אין פעולות להצגה</TableCell></TableRow>}
                {filtered.map((row, idx) => (
                  <TableRow key={row.id} className={(idx % 2 ? "bg-muted/20 " : "") + "border-b border-border hover:bg-primary/5"}>
                    <TableCell className="whitespace-nowrap tabular-nums border-l border-border/60 px-2 py-1.5 text-xs align-middle">{new Date(row.created_at).toLocaleString("he-IL")}</TableCell>
                    <TableCell className="whitespace-nowrap border-l border-border/60 px-2 py-1.5 text-xs font-bold align-middle">{ACTION_LABELS[row.action]}</TableCell>
                    <TableCell className="whitespace-nowrap border-l border-border/60 px-2 py-1.5 text-xs align-middle">{TABLE_LABELS[row.table_name] ?? row.table_name}</TableCell>
                    <TableCell className="border-l border-border/60 px-2 py-1.5 text-xs align-middle max-w-[420px] truncate">{describeRecord(row)}</TableCell>
                    <TableCell className="whitespace-nowrap border-l border-border/60 px-2 py-1.5 text-xs align-middle">
                      {row.undone_at ? <span className="text-muted-foreground">בוטל</span> : <span className="text-income font-bold">פעיל</span>}
                    </TableCell>
                    <TableCell className="text-center px-2 py-1.5 align-middle">
                      <Button size="sm" variant="outline" disabled={!!row.undone_at} onClick={() => setPendingUndo(row)}>
                        <RotateCcw className="w-3.5 h-3.5 ml-1" />בטל שינוי
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-3 border-t bg-muted/20 flex items-center justify-center gap-3">
            <span className="text-xs text-muted-foreground">מוצגות {filtered.length.toLocaleString("he-IL")} פעולות</span>
            {hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "טוען…" : "טען עוד"}
              </Button>
            )}
            {!hasNextPage && rows.length > 0 && <span className="text-xs text-muted-foreground">— סוף הרשימה —</span>}
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingUndo} onOpenChange={(open) => { if (!open) setPendingUndo(null); }}>
        <AlertDialogContent dir="rtl" className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-5 h-5 text-warning" />
              ביטול שינוי
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              בדוק את פרטי הפעולה לפני הביטול. לאחר האישור המערכת תחזיר את הרשומה למצב הקודם ככל שניתן.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingUndo && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/30 p-3">
                <Detail label="פעולה" value={ACTION_LABELS[pendingUndo.action]} />
                <Detail label="אזור" value={TABLE_LABELS[pendingUndo.table_name] ?? pendingUndo.table_name} />
                <Detail label="זמן" value={new Date(pendingUndo.created_at).toLocaleString("he-IL")} />
                <Detail label="פרטים" value={describeRecord(pendingUndo)} />
              </div>

              <div className="rounded-xl border overflow-hidden">
                <div className="px-3 py-2 bg-muted/40 font-bold">מה יקרה בביטול?</div>
                <div className="p-3 text-muted-foreground">
                  {pendingUndo.action === "insert" && "הרשומה שנוספה תימחק."}
                  {pendingUndo.action === "delete" && "הרשומה שנמחקה תיווצר מחדש עם הנתונים המקוריים."}
                  {pendingUndo.action === "update" && "השדות שנערכו יחזרו לערכים הקודמים."}
                </div>
                {pendingUndo.action === "update" && (
                  <div className="max-h-72 overflow-auto border-t">
                    <Table className="border-collapse">
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-right border-l">שדה</TableHead>
                          <TableHead className="text-right border-l">ערך נוכחי</TableHead>
                          <TableHead className="text-right">יחזור אל</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {changedFields(pendingUndo).map((field) => (
                          <TableRow key={field}>
                            <TableCell className="border-l text-xs font-bold">{fieldLabel(field)}</TableCell>
                            <TableCell className="border-l text-xs">{formatFieldValue(field, pendingUndo.new_data?.[field], lookupMaps)}</TableCell>
                            <TableCell className="text-xs">{formatFieldValue(field, pendingUndo.old_data?.[field], lookupMaps)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>לא לבטל</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingUndo && undoMutation.mutate(pendingUndo)}>
              אשר ביטול שינוי
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold truncate">{value}</div>
    </div>
  );
}

function describeRecord(row: ActionHistoryRow) {
  const data = row.new_data ?? row.old_data ?? {};
  if (row.table_name === "transactions") {
    const date = data.transaction_date ? formatDate(data.transaction_date) : "";
    const amount = data.amount != null ? ` · ${formatCurrency(Number(data.amount))}` : "";
    return [date, data.description || data.payee || data.reference || "תנועה"].filter(Boolean).join(" · ") + amount;
  }
  return data.name || data.full_name || data.email || row.record_id;
}

function changedFields(row: ActionHistoryRow) {
  const oldData = row.old_data ?? {};
  const newData = row.new_data ?? {};
  const keys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
  return keys
    .filter((key) => !HIDDEN_DETAIL_FIELDS.has(key))
    .filter((key) => JSON.stringify(oldData[key] ?? null) !== JSON.stringify(newData[key] ?? null))
    .slice(0, 20);
}

function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    transaction_date: "תאריך",
    value_date: "תאריך ערך",
    account_id: "חשבון",
    fund_id: "קופה",
    expense_type_id: "סוג",
    category_id: "קטגוריה",
    subcategory_id: "תת קטגוריה",
    description: "פרטים",
    note: "הערה",
    payee: "מוטב",
    reference: "אסמכתה",
    amount: "סכום",
    credit: "זכות",
    debit: "חובה",
    balance: "יתרה",
    name: "שם",
  };
  return labels[field] ?? field;
}

function formatFieldValue(field: string, value: any, lookupMaps: Record<string, Map<string, string>>) {
  if (value === null || value === undefined || value === "") return "—";
  if (lookupMaps[field]?.has(value)) return lookupMaps[field].get(value) ?? "—";
  if (field.includes("date") && typeof value === "string") return formatDate(value);
  if (["amount", "credit", "debit", "balance", "fee"].includes(field)) return formatCurrency(Number(value));
  if (typeof value === "boolean") return value ? "כן" : "לא";
  return String(value);
}
