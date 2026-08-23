import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to transaction changes with a debounced callback.
 *
 * History:
 *  - v1: every caller opened its own realtime channel and invalidated caches
 *    on each row event. Bulk operations (imports, bulk edits, undo of an
 *    import batch) emit one event per row, so the UI crawled.
 *  - v2: per-channel debounce.
 *  - v3 (current): ONE shared websocket subscription for the whole app, with
 *    a single debounce timer that fans out to every registered listener.
 *    The public API is unchanged, so call sites keep working as before.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let delayMs = 4000;

function ensureChannel() {
  if (channel) return;
  channel = supabase
    .channel("tx-shared")
    .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        listeners.forEach((fn) => {
          try {
            fn();
          } catch {
            /* one bad listener must not break the others */
          }
        });
      }, delayMs);
    })
    .subscribe();
}

function teardownIfIdle() {
  if (listeners.size > 0 || !channel) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  supabase.removeChannel(channel);
  channel = null;
}

export function useTransactionsRealtime(_channelName: string, onChange: () => void, delay = 4000) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    delayMs = Math.min(delayMs, delay);
    const listener: Listener = () => cbRef.current();
    listeners.add(listener);
    ensureChannel();
    return () => {
      listeners.delete(listener);
      teardownIfIdle();
    };
  }, [delay]);
}
