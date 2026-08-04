import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useFunds, useExpenseTypes, useCategories, useSubcategories } from "@/hooks/use-lookups";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const KEEP = "__keep__";
const CLEAR = "__clear__";

export function BulkEditDialog({
  open, onOpenChange, ids, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ids: string[];
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const { data: funds = [] } = useFunds();
  const { data: expTypes = [] } = useExpenseTypes();
  const { data: cats = [] } = useCategories();
  const { data: subs = [] } = useSubcategories();

  const [fund, setFund] = useState(KEEP);
  const [exp, setExp] = useState(KEEP);
  const [cat, setCat] = useState(KEEP);
  const [sub, setSub] = useState(KEEP);

  const apply = useMutation({
    mutationFn: async () => {
      const patch: {
        fund_id?: string | null;
        expense_type_id?: string | null;
        category_id?: string | null;
        subcategory_id?: string | null;
      } = {};
      if (fund !== KEEP) patch.fund_id = fund === CLEAR ? null : fund;
      if (exp !== KEEP) patch.expense_type_id = exp === CLEAR ? null : exp;
      if (cat !== KEEP) patch.category_id = cat === CLEAR ? null : cat;
      if (sub !== KEEP) patch.subcategory_id = sub === CLEAR ? null : sub;
      if (Object.keys(patch).length === 0) throw new Error("לא נבחר שום שדה לשינוי");
      const { error } = await supabase.from("transactions").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${ids.length} תנועות עודכנו`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      onOpenChange(false);
      setFund(KEEP); setExp(KEEP); setCat(KEEP); setSub(KEEP);
      onDone?.();
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  const Field = ({ label, value, onChange, items }: { label: string; value: string; onChange: (v: string) => void; items: { id: string; name: string }[] }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={KEEP}>— ללא שינוי —</SelectItem>
          <SelectItem value={CLEAR}>נקה ערך</SelectItem>
          {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>שינוי {ids.length} תנועות נבחרות</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="קופה" value={fund} onChange={setFund} items={funds} />
          <Field label="סוג" value={exp} onChange={setExp} items={expTypes} />
          <Field label="קטגוריה" value={cat} onChange={setCat} items={cats} />
          <Field label="תת קטגוריה" value={sub} onChange={setSub} items={subs} />
          <p className="text-xs text-muted-foreground">בחר "ללא שינוי" כדי להשאיר ערך קיים. בחר "נקה ערך" כדי להסיר אותו.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
            {apply.isPending ? "מעדכן…" : `החל על ${ids.length} תנועות`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
