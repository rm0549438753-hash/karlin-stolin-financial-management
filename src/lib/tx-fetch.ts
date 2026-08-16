import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";

/**
 * Shared full-table transaction fetcher used by the dashboard and the reports
 * screens.
 *
 * History:
 *  - v1: each screen paged through `transactions` itself (10+ round trips each).
 *  - v2: one shared cache entry, pages fetched in parallel.
 *  - v3 (current): ONE round trip to the `dashboard_rows()` database function.
 *    The function resolves the effective date server-side (checks accounts use
 *    `value_date`), drops date-less rows and returns a single JSON payload, so
 *    PostgREST's 1000-row ceiling no longer applies.
 */

export const TX_ALL_KEY = ["tx-all"] as const;

export type AnyTx = Record<string, any>;

export async function fetchAllTransactionsShared(): Promise<AnyTx[]> {
  if (!(await hasLiveSession())) return [];
  const { data, error } = await supabase.rpc("dashboard_rows");
  if (error) throw error;
  return (data ?? []) as AnyTx[];
}

