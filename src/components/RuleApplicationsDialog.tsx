import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listRuleApplications, revertRuleApplications } from "@/lib/classification.functions";

const FIELD_LABELS: Record<string, string> = {
  fund_id: "קופה",
  expense_type_id: "סוג",
  category_id: "קטגוריה",
  subcategory_id: "תת קטגוריה",
};

export function RuleApplicationsDialog({
  ruleId,
  ruleName,
  nameOf,
  canEdit,
  onClose,
}: {
  ruleId: string | null;
  ruleName?: string;
  nameOf: Map<string, string>;
  canEdit: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRuleApplications);
  const revertFn = useServerFn(revertRuleApplications);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["rule-applications", ruleId],
    enabled: !!ruleId,
    queryFn: () => listFn({ data: { ruleId: ruleId! } }) as Promise<any[]>,
  });

  const revert = useMutation({
    mutationFn: (vars: { id?: string; ruleId?: string }) => revertFn({ data: vars }),
    onSuccess: (res: any) => {
      toast.success(`בוטלו ${res?.reverted ?? 0} סיווגים`);
      qc.invalidateQueries({ queryKey: ["rule-applications", ruleId] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["classification-rules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "הביטול נכשל"),
  });

  const active = rows.filter((r: any) => !r.reverted_at).length;

  return (
    <Dialog open={!!ruleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>סיווגים שבוצעו — {ruleName}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {isLoading ? "טוען…" : `${rows.length} רשומות · ${active} פעילות`}
          </div>
          {canEdit && active > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={revert.isPending}
              onClick={() => revert.mutate({ ruleId: ruleId! })}
            >
              {revert.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              ביטול כל הסיווגים של הכלל
            </Button>
          )}
        </div>

        {!isLoading && rows.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">הכלל עדיין לא סיווג תנועות.</div>
        )}

        {rows.length > 0 && (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך תנועה</TableHead>
                  <TableHead>שם / תיאור</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>שדות שסווגו</TableHead>
                  <TableHead>מתי</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const tx = r.transaction ?? {};
                  const changed = (r.changed ?? {}) as Record<string, string>;
                  return (
                    <TableRow key={r.id} className={r.reverted_at ? "opacity-50" : ""}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {tx.transaction_date || tx.value_date
                          ? new Date(tx.transaction_date || tx.value_date).toLocaleDateString("he-IL")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-64 truncate">
                        {tx.payee || tx.description || tx.reference || "—"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {tx.amount == null ? "—" : Number(tx.amount).toLocaleString("he-IL")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {Object.entries(changed)
                          .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${nameOf.get(v) ?? ""}`)
                          .join(" · ")}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("he-IL")}
                      </TableCell>
                      <TableCell className="text-left">
                        {r.reverted_at ? (
                          <Badge variant="secondary">בוטל</Badge>
                        ) : canEdit ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="ביטול הסיווג"
                            disabled={revert.isPending}
                            onClick={() => revert.mutate({ id: r.id })}
                          >
                            <Undo2 className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
