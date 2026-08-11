import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to transaction changes with a debounced callback.
 *
 * Bulk operations (imports, bulk edits, undo of an import batch) emit one
 * realtime event per row. Invalidating the shared `tx-all` cache on every
 * event triggered hundreds of full-table refetches in a row and made the
 * whole UI crawl. The callback now fires at most once per `delay` ms.
 */
export function useTransactionsRealtime(channelName: string, onChange: () => void, delay = 4000) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          cbRef.current();
        }, delay);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [channelName, delay]);
}
