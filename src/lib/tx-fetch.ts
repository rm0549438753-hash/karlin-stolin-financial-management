import { supabase } from "@/integrations/supabase/client";

/**
 * Shared full-table transaction fetcher used by the dashboard and the reports
 * screens. Both used to run their own sequential page-by-page fetch (10+
 * round trips each, duplicated per screen). Now:
 *  - one cache entry (`TX_ALL_KEY`) shared by both screens
 *  - pages are fetched in PARALLEL after the first page reports the total count
 */

export const TX_ALL_KEY = ["tx-all"] as const;

export const TX_ALL_SELECT =
  "id, transaction_date, value_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit, payee, balance, reference, fee, channel, association";

const PAGE_SIZE = 1000;

export type AnyTx = Record<string, any>;

async function fetchPage(from: number, withCount: boolean) {
  const query = supabase
    .from("transactions")
    .select(TX_ALL_SELECT, withCount ? { count: "exact" } : undefined)
    .order("transaction_date", { ascending: false, nullsFirst: false })
    // deterministic tiebreaker — required because pages are fetched in parallel
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as AnyTx[], count: count ?? null };
}

export async function fetchAllTransactionsShared(): Promise<AnyTx[]> {
  const first = await fetchPage(0, true);
  const total = first.count ?? first.rows.length;
  if (total <= PAGE_SIZE) return first.rows;

  const offsets: number[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);

  const pages = await Promise.all(offsets.map((from) => fetchPage(from, false)));
  return first.rows.concat(...pages.map((p) => p.rows));
}
