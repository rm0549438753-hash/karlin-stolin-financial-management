import { useEffect, useState } from "react";

/**
 * Keyboard navigation for the transactions table/list: ArrowUp/ArrowDown moves
 * a highlighted row, Enter opens it for editing. Disabled while any dialog is
 * open or while typing inside an input/textarea/select.
 */
export function useRowKeyboardNav<T extends { id: string }>(
  rows: T[],
  onEdit: (row: T) => void,
  enabled: boolean,
) {
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;
      if (inField) return;
      if (rows.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = rows.findIndex((r) => r.id === highlightId);
        let nextIdx: number;
        if (idx === -1) nextIdx = 0;
        else nextIdx = e.key === "ArrowDown" ? Math.min(idx + 1, rows.length - 1) : Math.max(idx - 1, 0);
        const nextId = rows[nextIdx].id;
        setHighlightId(nextId);
        const el = document.querySelector(`[data-tx-id="${nextId}"]`);
        el?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && highlightId) {
        const row = rows.find((r) => r.id === highlightId);
        if (row) {
          e.preventDefault();
          onEdit(row);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, highlightId, enabled, onEdit]);

  // Clear highlight if it no longer exists in the current row set
  useEffect(() => {
    if (highlightId && !rows.some((r) => r.id === highlightId)) setHighlightId(null);
  }, [rows, highlightId]);

  return { highlightId, setHighlightId };
}
