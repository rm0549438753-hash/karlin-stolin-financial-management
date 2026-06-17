import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useFunds, useExpenseTypes, useCategories, useSubcategories } from "@/hooks/use-lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

const NULL_VALUE = "__none__";

export type TransactionRow = {
  id: string;
  account_id: string;
  transaction_date: string;
  value_date: string | null;
  amount: number;
  balance: number | null;
  description: string | null;
  reference: string | null;
  fee: number | null;
  channel: string | null;
  fund_id: string | null;
  expense_type_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  note: string | null;
};

type FormValues = {
  account_id: string;
  transaction_date: string;
  direction: "credit" | "debit";
  amount: string;
  description: string;
  reference: string;
  fee: string;
  channel: string;
  fund_id: string;
  expense_type_id: string;
  category_id: string;
  subcategory_id: string;
  note: string;
};

export function TransactionDialog({
  open, onOpenChange, initial, defaultAccount,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: TransactionRow | null;
  defaultAccount?: string;
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const { data: funds = [] } = useFunds();
  const { data: expTypes = [] } = useExpenseTypes();
  const { data: cats = [] } = useCategories();
  const { data: subs = [] } = useSubcategories();

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: getDefaults(initial, defaultAccount),
  });

  // when dialog opens, reset
  useMemo(() => {
    if (open) reset(getDefaults(initial, defaultAccount));
  }, [open, initial, defaultAccount, reset]);

  const direction = watch("direction");
  const catId = watch("category_id");
  const filteredSubs = subs.filter((s) => !s.category_id || s.category_id === catId);

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const amt = Number(v.amount);
      if (isNaN(amt) || amt <= 0) throw new Error("יש להזין סכום חיובי");
      const signed = v.direction === "debit" ? -Math.abs(amt) : Math.abs(amt);
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;
      const payload = {
        account_id: v.account_id,
        transaction_date: v.transaction_date,
        amount: signed,
        description: v.description || null,
        reference: v.reference || null,
        fee: v.fee ? Number(v.fee) : null,
        channel: v.channel || null,
        fund_id: v.fund_id === NULL_VALUE || !v.fund_id ? null : v.fund_id,
        expense_type_id: v.expense_type_id === NULL_VALUE || !v.expense_type_id ? null : v.expense_type_id,
        category_id: v.category_id === NULL_VALUE || !v.category_id ? null : v.category_id,
        subcategory_id: v.subcategory_id === NULL_VALUE || !v.subcategory_id ? null : v.subcategory_id,
        note: v.note || null,
        updated_by: userId,
      };
      if (initial) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "תנועה עודכנה" : "תנועה נוספה");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["tx-dashboard"] });
      qc.invalidateQueries({ queryKey: ["tx-reports"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "עריכת תנועה" : "תנועה חדשה"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="חשבון">
            <Select value={watch("account_id")} onValueChange={(v) => setValue("account_id", v)}>
              <SelectTrigger><SelectValue placeholder="בחר חשבון" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="תאריך">
            <Input type="date" {...register("transaction_date", { required: true })} dir="ltr" />
          </Field>

          <Field label="סוג פעולה">
            <ToggleGroup type="single" value={direction} onValueChange={(v) => v && setValue("direction", v as any)} className="w-full">
              <ToggleGroupItem value="credit" className="flex-1 data-[state=on]:bg-income data-[state=on]:text-success-foreground">זכות / הכנסה</ToggleGroupItem>
              <ToggleGroupItem value="debit" className="flex-1 data-[state=on]:bg-expense data-[state=on]:text-destructive-foreground">חובה / הוצאה</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field label="סכום ₪">
            <Input type="number" step="0.01" min="0" dir="ltr" {...register("amount", { required: true })} />
          </Field>

          <Field label="תיאור" full>
            <Input {...register("description")} />
          </Field>

          <Field label="אסמכתה">
            <Input {...register("reference")} dir="ltr" />
          </Field>
          <Field label="עמלה ₪">
            <Input type="number" step="0.01" dir="ltr" {...register("fee")} />
          </Field>

          <Field label="ערוץ ביצוע">
            <Input {...register("channel")} placeholder="אינטרנט / סניף / יזום מחשב…" />
          </Field>
          <Field label="קופה">
            <LookupSelect value={watch("fund_id")} onChange={(v) => setValue("fund_id", v)} items={funds} />
          </Field>

          <Field label="סוג הוצאה">
            <LookupSelect value={watch("expense_type_id")} onChange={(v) => setValue("expense_type_id", v)} items={expTypes} />
          </Field>
          <Field label="קטגוריה">
            <LookupSelect value={watch("category_id")} onChange={(v) => { setValue("category_id", v); setValue("subcategory_id", NULL_VALUE); }} items={cats} />
          </Field>

          <Field label="תת-קטגוריה">
            <LookupSelect value={watch("subcategory_id")} onChange={(v) => setValue("subcategory_id", v)} items={filteredSubs} />
          </Field>

          <Field label="הערה" full>
            <Textarea {...register("note")} rows={2} />
          </Field>

          <DialogFooter className="md:col-span-2 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? "שומר…" : "שמירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function LookupSelect({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: { id: string; name: string }[] }) {
  return (
    <Select value={value || NULL_VALUE} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NULL_VALUE}>— ללא —</SelectItem>
        {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function getDefaults(initial?: TransactionRow | null, defaultAccount?: string): FormValues {
  const today = new Date().toISOString().slice(0, 10);
  if (!initial) {
    return {
      account_id: defaultAccount ?? "",
      transaction_date: today,
      direction: "debit",
      amount: "",
      description: "",
      reference: "",
      fee: "",
      channel: "",
      fund_id: NULL_VALUE,
      expense_type_id: NULL_VALUE,
      category_id: NULL_VALUE,
      subcategory_id: NULL_VALUE,
      note: "",
    };
  }
  return {
    account_id: initial.account_id,
    transaction_date: initial.transaction_date,
    direction: Number(initial.amount) >= 0 ? "credit" : "debit",
    amount: String(Math.abs(Number(initial.amount))),
    description: initial.description ?? "",
    reference: initial.reference ?? "",
    fee: initial.fee == null ? "" : String(initial.fee),
    channel: initial.channel ?? "",
    fund_id: initial.fund_id ?? NULL_VALUE,
    expense_type_id: initial.expense_type_id ?? NULL_VALUE,
    category_id: initial.category_id ?? NULL_VALUE,
    subcategory_id: initial.subcategory_id ?? NULL_VALUE,
    note: initial.note ?? "",
  };
}
