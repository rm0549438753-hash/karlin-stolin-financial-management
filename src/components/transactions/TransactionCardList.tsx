import { Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const fmtNum = (v: any) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function rowAmount(r: any): number {
  if (r.amount !== undefined && r.amount !== null) return Number(r.amount);
  return (Number(r.credit) || 0) - (Number(r.debit) || 0);
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">{children}</span>;
}

export type CardCtx = {
  fundMap: Map<string, string>;
  expMap: Map<string, string>;
  catMap: Map<string, string>;
  subMap: Map<string, string>;
};

/** Mobile (below md) stacked-card view of transactions, replacing the table. */
export function TransactionCardList({
  rows, ctx, selectedIds, onToggle, onEdit, onDelete, canEdit, canDelete, highlightId,
}: {
  rows: any[];
  ctx: CardCtx;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (row: any) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  highlightId?: string | null;
}) {
  if (rows.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">אין תנועות להצגה</div>;
  }
  return (
    <div className="space-y-2 p-2">
      {rows.map((r) => {
        const amt = rowAmount(r);
        const isChecked = selectedIds.has(r.id);
        const isHighlighted = highlightId === r.id;
        const desc = r.description ?? r.payee ?? r.note ?? "—";
        return (
          <div
            key={r.id}
            data-tx-id={r.id}
            onClick={() => onEdit(r)}
            className={
              "rounded-xl border bg-card p-3 space-y-2 cursor-pointer transition " +
              (isHighlighted ? "ring-2 ring-primary bg-primary/10" : isChecked ? "bg-primary/5" : "")
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggle(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="בחר תנועה"
                />
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(r.transaction_date)}</span>
              </div>
              <span className={"font-bold tabular-nums text-sm " + (amt >= 0 ? "text-income" : "text-expense")}>
                {fmtNum(Math.abs(amt))} ₪
              </span>
            </div>
            <div className="text-sm font-medium truncate">{desc}</div>
            <div className="flex flex-wrap gap-1.5">
              {r.fund_id && <Badge>{ctx.fundMap.get(r.fund_id)}</Badge>}
              {r.expense_type_id && <Badge>{ctx.expMap.get(r.expense_type_id)}</Badge>}
              {r.category_id && <Badge>{ctx.catMap.get(r.category_id)}</Badge>}
              {r.subcategory_id && <Badge>{ctx.subMap.get(r.subcategory_id)}</Badge>}
              {!r.fund_id && !r.expense_type_id && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-dashed border-amber-300">לא מסווג</span>
              )}
            </div>
            {(canEdit || canDelete) && (
              <div className="flex justify-end gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                {canEdit && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
                {canDelete && onDelete && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
