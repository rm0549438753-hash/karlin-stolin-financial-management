import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";

/**
 * Reports used to download every transaction (≈9.7k rows) on every visit, even
 * though each report only looks at a narrow slice. This fetches just the slice
 * the open tab needs, page by page, so the screen loads with a fraction of the
 * data. Row shape is unchanged, so the report components keep working as-is.
 */
const PAGE = 1000;
const TX_SELECT =
  "id, transaction_date, value_date, amount, account_id, fund_id, expense_type_id, category_id, subcategory_id, description, note, credit, debit, payee, balance, reference, fee, channel, association, payer_name";

export type ReportSlice = "future-checks" | "uncategorized" | "no-date" | "payees";

// First page carries the total count; the remaining pages are then fetched
// in small parallel batches instead of one-by-one.
async function fetchAllPages(build: (count?: boolean) => any) {
  const first = await build(true).range(0, PAGE - 1);
  if (first.error) throw first.error;
  const out: any[] = [...(first.data ?? [])];
  const total = first.count ?? out.length;
  const offsets: number[] = [];
  for (let o = PAGE; o < total; o += PAGE) offsets.push(o);
  for (let i = 0; i < offsets.length; i += 3) {
    const res = await Promise.all(offsets.slice(i, i + 3).map((o) => build().range(o, o + PAGE - 1)));
    for (const r of res) {
      if (r.error) throw r.error;
      out.push(...(r.data ?? []));
    }
  }
  return out;
}

async function fetchSlice(slice: ReportSlice, checksAccountId?: string) {
  if (!(await hasLiveSession())) return [];
  const today = new Date().toISOString().slice(0, 10);

  if (slice === "future-checks") {
    if (!checksAccountId) return [];
    return fetchAllPages((c?: boolean) =>
      supabase
        .from("transactions")
        .select(TX_SELECT, c ? { count: "exact" } : undefined)
        .eq("account_id", checksAccountId)
        .or(`value_date.gt.${today},and(value_date.is.null,transaction_date.gt.${today})`)
        .order("value_date", { ascending: true }),
    );
  }

  if (slice === "uncategorized") {
    return fetchAllPages((c?: boolean) =>
      supabase
        .from("transactions")
        .select(TX_SELECT, c ? { count: "exact" } : undefined)
        .is("fund_id", null)
        .is("expense_type_id", null)
        .order("transaction_date", { ascending: false }),
    );
  }

  if (slice === "no-date") {
    return fetchAllPages((c?: boolean) =>
      supabase.from("transactions").select(TX_SELECT, c ? { count: "exact" } : undefined).is("transaction_date", null).is("value_date", null),
    );
  }

  // payees — every row: names are also derived from description/reference/note
  return fetchAllPages((c?: boolean) =>
    supabase
      .from("transactions")
      .select(TX_SELECT, c ? { count: "exact" } : undefined)
      .order("transaction_date", { ascending: false }),
  );
}

export function useReportRows(slice: ReportSlice, enabled: boolean, checksAccountId?: string) {
  return useQuery({
    queryKey: ["report-rows", slice, checksAccountId ?? null],
    queryFn: () => fetchSlice(slice, checksAccountId),
    enabled: enabled && (slice !== "future-checks" || !!checksAccountId),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });
}
