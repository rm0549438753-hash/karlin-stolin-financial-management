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
  const [year, setYear] = useState<number>(currentYear);
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

  const [drafts, setDrafts] = useState<Record<string, { amount: string; note: string }>>({});

  // Reset drafts when year or data changes
  useEffect(() => {
    const next: Record<string, { amount: string; note: string }> = {};
    relevantFunds.forEach((f) => {
      const b = byFund.get(f.id);
      next[f.id] = {
        amount: b ? String(b.amount) : "",
        note: b?.note ?? "",
      };
    });
    setDrafts(next);
  }, [relevantFunds, byFund]);

  const [savingId, setSavingId] = useState<string | null>(null);

  async function save(fundId: string) {
    if (!canEdit) return;
    setSavingId(fundId);
    try {
      const d = drafts[fundId];
      const amount = d.amount === "" ? 0 : Number(d.amount);
      if (!Number.isFinite(amount)) {
        toast.error("סכום לא תקין");
        return;
      }
      const existing = byFund.get(fundId);
      if (existing) {
        const { error } = await supabase
          .from("fund_opening_balances")
          .update({ amount, note: d.note || null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fund_opening_balances")
          .insert({ fund_id: fundId, year, amount, note: d.note || null });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["fund_opening_balances"], refetchType: "active" });
      toast.success("נשמר");
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בשמירה");
    } finally {
      setSavingId(null);
    }
  }

  const total = useMemo(() => {
    return relevantFunds.reduce((s, f) => {
      const b = byFund.get(f.id);
      return s + (b ? Number(b.amount) : 0);
    }, 0);
  }, [relevantFunds, byFund]);

  const years = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear - 1, currentYear + 1, 2026]);
    balances.forEach((b) => set.add(b.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [balances, currentYear]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 bg-muted/40 border-b rounded-t-xl">
        <div>
          <CardTitle className="text-2xl">יתרת תחילת שנה - קופות</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            חיובי = יתרה זכות (הקופה חייבת למרכז) · שלילי = חוב (המרכז חייב לקופה)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">שנה:</span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
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
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">קופה</TableHead>
                <TableHead className="text-right w-48">יתרת תחילת שנה (₪)</TableHead>
                <TableHead className="text-right">הערה</TableHead>
                <TableHead className="text-left w-28">פעולה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relevantFunds.map((f) => {
                const d = drafts[f.id] ?? { amount: "", note: "" };
                return (
                  <TableRow key={f.id}>
                    <TableCell className="text-right font-medium">{f.name}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        disabled={!canEdit}
                        value={d.amount}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [f.id]: { ...prev[f.id], amount: e.target.value } }))
                        }
                        className="tabular-nums text-right"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        disabled={!canEdit}
                        value={d.note}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [f.id]: { ...prev[f.id], note: e.target.value } }))
                        }
                        placeholder="הערה (אופציונלי)"
                      />
                    </TableCell>
                    <TableCell className="text-left">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || savingId === f.id}
                        onClick={() => save(f.id)}
                      >
                        <Save className="w-4 h-4 ml-1" />
                        שמור
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {relevantFunds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    אין קופות מוגדרות
                  </TableCell>
                </TableRow>
              )}
              {relevantFunds.length > 0 && (
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell className="text-right">סה"כ יתרת תחילת שנה</TableCell>
                  <TableCell className={`text-right tabular-nums ${total >= 0 ? "text-income" : "text-expense"}`}>
                    {formatCurrency(total)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
