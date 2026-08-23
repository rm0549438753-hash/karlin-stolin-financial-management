import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal strip for toolbars / tab rows.
 *
 * Instead of silently clipping its content on narrow screens it shows a soft
 * edge fade plus small arrow buttons on the side that still has content,
 * so it is obvious the row continues. RTL-safe (scrollLeft is negative).
 */
export function ScrollStrip({
  children,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setEdges({ start: pos > 2, end: max > 2 && pos < max - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [measure, children]);

  const nudge = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className={"relative " + className}>
      <div
        ref={ref}
        onScroll={measure}
        className={"flex items-center gap-2 overflow-x-auto whitespace-nowrap [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 " + innerClassName}
      >
        {children}
      </div>

      {edges.start && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />
          <button
            type="button"
            aria-label="גלול ימינה"
            onClick={() => nudge(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full border bg-card/95 shadow-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
      {edges.end && (
        <>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent" />
          <button
            type="button"
            aria-label="גלול שמאלה"
            onClick={() => nudge(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full border bg-card/95 shadow-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
