import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";

/**
 * Dashboard data used to be the whole transactions table (~10k rows, ~1.4MB)
 * downloaded on every visit and aggregated in the browser — the main reason the
 * dashboard felt slow, especially on phones.
 *
 * Now the database groups the numbers (per tab / month / type / fund) and
 * returns a few hundred summary rows (~40KB). Transaction rows are fetched only
 * for the slice the user actually drills into.
 */

export type DashboardTab = "institution" | "project" | "vaults";

export type SummaryRow = {
  tab: DashboardTab;
  month: string; // YYYY-MM
  expenseTypeId: string | null;
  fundId: string | null;
  income: number;
  expense: number; // positive magnitude
  count: number;
};

export const DASHBOARD_SUMMARY_KEY = ["dashboard-summary"] as const;

async function fetchSummary(): Promise<SummaryRow[]> {
  if (!(await hasLiveSession())) return [];
  const { data, error } = await (supabase as any).rpc("dashboard_summary");
  if (error) throw error;
  const rows: any[][] = data?.rows ?? [];
  return rows.map((r) => ({
    tab: r[0] as DashboardTab,
    month: r[1] as string,
    expenseTypeId: (r[2] as string | null) ?? null,
    fundId: (r[3] as string | null) ?? null,
    income: Number(r[4] ?? 0),
    expense: Number(r[5] ?? 0),
    count: Number(r[6] ?? 0),
  }));
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: DASHBOARD_SUMMARY_KEY,
    queryFn: fetchSummary,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });
}

/* ===================== Drill-down rows (on demand) ===================== */

export type DrillQuery = {
  title: string;
  tab: DashboardTab;
  from?: string | null;
  to?: string | null;
  kind?: "all" | "income" | "expense";
  /** expense type id, or "__none__" for transactions without a type */
  expenseType?: string | null;
  fund?: string | null;
};

export type DrillTx = {
  id: string;
  transaction_date: string;
  amount: number;
  account_id: string;
  fund_id: string | null;
  expense_type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  description: string | null;
  note: string | null;
  credit: number | null;
  debit: number | null;
  payee: string | null;
  reference: string | null;
  association: string | null;
};

export function useDrillRows(q: DrillQuery | null) {
  return useQuery({
    queryKey: ["dashboard-drill", q],
    enabled: !!q,
    staleTime: 60_000,
    queryFn: async (): Promise<DrillTx[]> => {
      if (!q) return [];
      if (!(await hasLiveSession())) return [];
      const { data, error } = await (supabase as any).rpc("dashboard_drill", {
        p_tab: q.tab,
        p_from: q.from ?? null,
        p_to: q.to ?? null,
        p_kind: q.kind ?? "all",
        p_expense_type: q.expenseType ?? null,
        p_fund: q.fund ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) }));
    },
  });
}

/* ===================== Small helpers ===================== */

export function monthRange(year: string, month?: string): { from: string; to: string } {
  if (month && month !== "all") {
    const y = Number(year);
    const m = Number(month);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(last).padStart(2, "0")}` };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}
