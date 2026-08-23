import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { idbGet, idbSet } from "@/lib/idb-cache";

/**
 * Mirrors a query result on the device (IndexedDB) so returning to the same
 * screen/filter paints immediately from the last known rows while the fresh
 * data loads in the background. Purely a display accelerator — the network
 * result always wins.
 */
export function useIdbQueryCache<T>(queryKey: readonly unknown[], data: T | undefined, enabled = true) {
  const qc = useQueryClient();
  const key = `q:${JSON.stringify(queryKey)}`;

  // Seed from device cache when the in-memory cache is empty.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (qc.getQueryData(queryKey as any)) return;
    idbGet<T>(key).then((cached) => {
      if (cancelled || cached === undefined) return;
      if (qc.getQueryData(queryKey as any)) return;
      qc.setQueryData(queryKey as any, cached);
    });
    return () => {
      cancelled = true;
    };
  }, [key, enabled]);

  // Persist fresh results.
  useEffect(() => {
    if (!enabled || data === undefined) return;
    const t = setTimeout(() => void idbSet(key, data).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [key, data, enabled]);
}
