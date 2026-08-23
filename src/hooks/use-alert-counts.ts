import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";

export const ALERT_COUNTS_KEY = ["tx-alert-counts"] as const;

export type AlertCounts = {
  by_account: Record<string, number>;
  uncategorized_total: number;
  no_date: number;
};

const EMPTY: AlertCounts = { by_account: {}, uncategorized_total: 0, no_date: 0 };

/**
 * One indexed round trip that replaces the repeated full-table COUNT scans that
 * the alerts banner and every transactions screen used to run separately.
 */
export function useAlertCounts() {
  return useQuery({
    queryKey: ALERT_COUNTS_KEY,
    queryFn: async (): Promise<AlertCounts> => {
      if (!(await hasLiveSession())) return EMPTY;
      const { data, error } = await (supabase as any).rpc("tx_alert_counts");
      if (error) throw error;
      return { ...EMPTY, ...(data as AlertCounts) };
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}
