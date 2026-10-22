import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFunds } from "@/hooks/use-lookups";
import { useUserRole } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Save } from "lucide-react";

const IRRELEVANT_FUND = "לא רלוונטי";

export type FundOpeningBalance = {
  id: string;
  fund_id: string;
  year: number;
  amount: number;
  note: string | null;
};

export function useFundOpeningBalances(year: number) {
  return useQuery({
    queryKey: ["fund_opening_balances", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fund_opening_balances")
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as FundOpeningBalance[];
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function FundOpeningBalancesReport() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(2026);
  const { data: funds = [] } = useFunds();
  const { data: role } = useUserRole();
  const canEdit = !!role?.canEdit;
  const { data: balances = [] } = useFundOpeningBalances(year);
  const qc = useQueryClient();

  const relevantFunds = useMemo(
    () =>
      [...funds]
        .filter((f) => f.name !== IRRELEVANT_FUND)
        .sort((a, b) => a.name.localeCompare(b.name, "he")),
    [funds],
  );

  const byFund = useMemo(() => {
    const m = new Map<string, FundOpeningBalance>();
    balances.forEach((b) => m.set(b.fund_id, b));
    return m;
  }, [balances]);

  type Draft = { debit: string; credit: string; note: string };
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => { setDirty(new Set()); }, [year]);

  // Fill from saved values without wiping rows the user is editing
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      relevantFunds.forEach((f) => {
        if (dirty.has(f.id) && prev[f.id]) { next[f.id] = prev[f.id]; return; }
        const b = byFund.get(f.id);
        const a = b ? Number(b.amount) : 0;
        next[f.id] = {
          debit: b && a > 0 ? String(a) : "",
          credit: b && a < 0 ? String(-a) : "",
          note: b?.note ?? "",
        };
      });
      return next;
    });
  }, [relevantFunds, byFund, dirty]);

  function edit(fundId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [fundId]: { ...prev[fundId], ...patch } }));
    setDirty((prev) => new Set(prev).add(fundId));
  }

  const { data: activity = [] } = useQuery({
    queryKey: ["fund_activity", year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fund_activity", { p_year: year });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const actByFund = useMemo(() => {
    const m = new Map<string, { received: number; returned: number }>();
    activity.forEach((r: any) => m.set(r.fund_id, { received: Number(r.received), returned: Number(r.returned) }));
    return m;
  }, [activity]);

  const [saving, setSaving] = useState(false);

  async function saveAll() {
    if (!canEdit || dirty.size === 0) return;
    setSaving(true);
    try {
      for (const fundId of dirty) {
        const d = drafts[fundId];
        const deb = d.debit === "" ? 0 : Number(d.debit);
        const cred = d.credit === "" ? 0 : Number(d.credit);
        if (!Number.isFinite(deb) || !Number.isFinite(cred) || deb < 0 || cred < 0) {
          toast.error("סכום לא תקין");
          return;
        }
        if (deb > 0 && cred > 0) {
          toast.error("יש למלא חובה או זכות בלבד, לא את שניהם");
          return;
        }
      }
      for (const fundId of dirty) {
        const d = drafts[fundId];
        const amount = (d.debit === "" ? 0 : Number(d.debit)) - (d.credit === "" ? 0 : Number(d.credit));
        const existing = byFund.get(fundId);
        if (existing) {
          const { error } = await supabase.from("fund_opening_balances")
            .update({ amount, note: d.note || null }).eq("id", existing.id);
          if (error) throw error;
        } else if (d.debit !== "" || d.credit !== "" || d.note) {
          const { error } = await supabase.from("fund_opening_balances")
            .insert({ fund_id: fundId, year, amount, note: d.note || null });
          if (error) throw error;
        }
      }
      const n = dirty.size;
      setDirty(new Set());
      await qc.invalidateQueries({ queryKey: ["fund_opening_balances"], refetchType: "active" });
      toast.success(`נשמרו ${n} קופות`);
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (dirty.size === 0) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const rows = useMemo(() => relevantFunds.map((f) => {
    const opening = byFund.has(f.id) ? Number(byFund.get(f.id)!.amount) : 0;
    const a = actByFund.get(f.id) ?? { received: 0, returned: 0 };
    return { f, opening, ...a, current: opening - a.received + a.returned };
  }), [relevantFunds, byFund, actByFund]);

  const totals = useMemo(() => rows.reduce((s, r) => ({
    opening: s.opening + r.opening, received: s.received + r.received,
    returned: s.returned + r.returned, current: s.current + r.current,
  }), { opening: 0, received: 0, returned: 0, current: 0 }), [rows]);

  const fmtBal = (v: number) =>
    Math.abs(v) < 0.005 ? "—" : `${formatCurrency(Math.abs(v))} ${v > 0 ? "חובה" : "זכות"}`;
  const balCls = (v: number) => (v > 0 ? "text-income" : v < 0 ? "text-expense" : "text-muted-foreground");

  const years = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear - 1, currentYear + 1, 2026]);
    balances.forEach((b) => set.add(b.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [balances, currentYear]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 bg-muted/40 border-b rounded-t-xl">
        <div>
          <CardTitle className="text-2xl">יתרות קופות</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            יתרה לסוף {year - 1} (פתיחת {year}) · חובה = הקופה חייבת לנו · זכות = אנחנו חייבים לקופה
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">יתרה ל:</span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>סוף {y - 1}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {!canEdit && (
          <p className="text-sm text-muted-foreground mb-3">
            צפייה בלבד. רק מנהל או עורך יכולים לערוך יתרות.
          </p>
        )}
        {canEdit && (
          <div className="flex items-center justify-end gap-3 mb-3">
            {dirty.size > 0 && <span className="text-sm text-warning">{dirty.size} שינויים שלא נשמרו</span>}
            <Button onClick={saveAll} disabled={saving || dirty.size === 0}>
              <Save className="w-4 h-4 ml-1" />
              {saving ? "שומר..." : "שמור הכל"}
            </Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">קופה</TableHead>
                <TableHead className="text-right w-36">חובה – חייבים לנו (₪)</TableHead>
                <TableHead className="text-right w-36">זכות – אנחנו חייבים (₪)</TableHead>
                <TableHead className="text-right">הערה</TableHead>
                <TableHead className="text-right">התקבל מהקופה</TableHead>
                <TableHead className="text-right">הוחזר לקופה</TableHead>
                <TableHead className="text-right">יתרה נוכחית</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ f, received, returned, current }) => {
                const d = drafts[f.id] ?? { debit: "", credit: "", note: "" };
                const isDirty = dirty.has(f.id);
                return (
                  <TableRow key={f.id} className={isDirty ? "bg-warning/10" : undefined}>
                    <TableCell className="text-right font-medium">{f.name}{isDirty && " •"}</TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" min="0" inputMode="decimal" disabled={!canEdit}
                        value={d.debit} placeholder="—" className="tabular-nums text-right"
                        onChange={(e) => edit(f.id, { debit: e.target.value, credit: e.target.value ? "" : d.credit })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" min="0" inputMode="decimal" disabled={!canEdit}
                        value={d.credit} placeholder="—" className="tabular-nums text-right"
                        onChange={(e) => edit(f.id, { credit: e.target.value, debit: e.target.value ? "" : d.debit })} />
                    </TableCell>
                    <TableCell>
                      <Input disabled={!canEdit} value={d.note} placeholder="הערה (אופציונלי)"
                        onChange={(e) => edit(f.id, { note: e.target.value })} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{received ? formatCurrency(received) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{returned ? formatCurrency(returned) : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${balCls(current)}`}>{fmtBal(current)}</TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">אין קופות מוגדרות</TableCell>
                </TableRow>
              )}
              {rows.length > 0 && (
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell className="text-right">סה"כ</TableCell>
                  <TableCell colSpan={3} className={`text-right tabular-nums ${balCls(totals.opening)}`}>
                    פתיחה: {fmtBal(totals.opening)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.received)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.returned)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${balCls(totals.current)}`}>{fmtBal(totals.current)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
