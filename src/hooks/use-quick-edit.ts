import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type QuickEditField = "fund_id" | "expense_type_id" | "category_id" | "subcategory_id";

/**
 * Inline quick-edit mutation for a single transaction field (fund / expense type /
 * category / subcategory). Applies an optimistic update to every cached
 * ["transactions", ...] query and rolls back on error.
 */
export function useQuickEditTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: QuickEditField; value: string | null }) => {
      const patch: {
        fund_id?: string | null;
        expense_type_id?: string | null;
        category_id?: string | null;
        subcategory_id?: string | null;
      } = { [field]: value };
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw error;
    },

    onMutate: async ({ id, field, value }) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snapshots: Array<[readonly unknown[], unknown]> = [];
      qc.getQueryCache().findAll({ queryKey: ["transactions"] }).forEach((q) => {
        snapshots.push([q.queryKey, q.state.data]);
        qc.setQueryData(q.queryKey, (old: any[] | undefined) =>
          old?.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
        );
      });
      return { snapshots };
    },
    onError: (e: any, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e.message ?? "שגיאה בעדכון");
    },
    onSuccess: () => {
      toast.success("עודכן בהצלחה");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
    },
  });
}
