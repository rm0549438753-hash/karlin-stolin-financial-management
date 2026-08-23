import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TX_ALL_KEY, fetchAllTransactionsShared, loadCachedTransactions, type AnyTx } from "@/lib/tx-fetch";

/**
 * Shared "all transactions" query used by the dashboard and reports.
 *
 * On mount it seeds the cache from the device (IndexedDB) so the screen paints
 * immediately with the last known data, then the fresh payload replaces it as
 * soon as it arrives. Data, shape and downstream logic are unchanged.
 */
export function useAllTransactions() {
  const qc = useQueryClient();

  useEffect(() => {
    if (qc.getQueryData(TX_ALL_KEY)) return;
    let cancelled = false;
    loadCachedTransactions().then((cached) => {
      if (cancelled || !cached?.length) return;
      if (qc.getQueryData(TX_ALL_KEY)) return;
      qc.setQueryData<AnyTx[]>(TX_ALL_KEY, cached);
    });
    return () => {
      cancelled = true;
    };
  }, [qc]);

  return useQuery({
    queryKey: TX_ALL_KEY,
    queryFn: fetchAllTransactionsShared,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev: any) => prev,
  });
}
