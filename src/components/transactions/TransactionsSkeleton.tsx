import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

/** Skeleton rows for the desktop transactions table while data is loading. */
export function TableRowsSkeleton({ columnCount, rows = 10 }: { columnCount: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="w-7 px-0.5"><Skeleton className="h-3.5 w-3.5 rounded" /></TableCell>
          {Array.from({ length: columnCount }).map((_, j) => (
            <TableCell key={j} className="px-1.5 py-1.5"><Skeleton className="h-3.5 w-full" /></TableCell>
          ))}
          <TableCell className="w-16 px-1"><Skeleton className="h-3.5 w-8 mx-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

/** Skeleton cards for the mobile transactions list while data is loading. */
export function CardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-3 space-y-2">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the totals/summary bar. */
export function SummarySkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <Skeleton className="h-4 w-24" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
