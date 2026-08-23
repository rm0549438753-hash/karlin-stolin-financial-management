import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";
import { idbGet, idbSet } from "@/lib/idb-cache";

/**
 * Shared full-table transaction fetcher used by the dashboard and the reports
 * screens.
 *
 * History:
 *  - v1: each screen paged through `transactions` itself (10+ round trips each).
 *  - v2: one shared cache entry, pages fetched in parallel.
 *  - v3: ONE round trip to the `dashboard_rows()` database function.
 *  - v4 (current): `dashboard_rows_compact()` — the same data, but columnar and
 *    dictionary-encoded server-side (repeated account/fund/type/category UUIDs
 *    become small integers). The payload shrank from ~5.3MB to ~1.4MB, which is
 *    what made mobile feel stuck. The rows are re-hydrated here into exactly the
 *    same object shape as before, so every call site is unchanged.
 *    The last payload is also mirrored into IndexedDB so a screen can paint
 *    immediately on the next visit while the fresh data loads in the background.
 */

export const TX_ALL_KEY = ["tx-all"] as const;
const IDB_KEY = "tx-all-v4";

export type AnyTx = Record<string, any>;

type CompactPayload = {
  v: number;
  acc: string[];
  fund: string[];
  et: string[];
  cat: string[];
  sub: string[];
  rows: any[][];
};

function pick(dict: string[], idx: number | null): string | null {
  // array_position() is 1-based; NULL for a null/absent reference.
  return idx == null ? null : (dict[idx - 1] ?? null);
}

function hydrate(payload: CompactPayload): AnyTx[] {
  const { acc = [], fund = [], et = [], cat = [], sub = [], rows = [] } = payload ?? ({} as any);
  const out: AnyTx[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    out[i] = {
      id: r[0],
      transaction_date: r[1],
      value_date: r[2],
      amount: r[3] == null ? 0 : Number(r[3]),
      account_id: pick(acc, r[4]),
      fund_id: pick(fund, r[5]),
      expense_type_id: pick(et, r[6]),
      category_id: pick(cat, r[7]),
      subcategory_id: pick(sub, r[8]),
      description: r[9],
      note: r[10],
      credit: r[11] == null ? null : Number(r[11]),
      debit: r[12] == null ? null : Number(r[12]),
      payee: r[13],
      reference: r[14],
      association: r[15],
      balance: r[16] == null ? null : Number(r[16]),
      fee: r[17] == null ? null : Number(r[17]),
      channel: r[18],
    };
  }
  return out;
}

export async function fetchAllTransactionsShared(): Promise<AnyTx[]> {
  if (!(await hasLiveSession())) return [];
  const { data, error } = await (supabase as any).rpc("dashboard_rows_compact");
  if (error) throw error;
  const rows = hydrate(data as CompactPayload);
  void idbSet(IDB_KEY, data).catch(() => {});
  return rows;
}

/** Last known payload from the device, used as instant initial data. */
export async function loadCachedTransactions(): Promise<AnyTx[] | undefined> {
  try {
    const cached = await idbGet<CompactPayload>(IDB_KEY);
    if (!cached || !Array.isArray(cached.rows)) return undefined;
    return hydrate(cached);
  } catch {
    return undefined;
  }
}
