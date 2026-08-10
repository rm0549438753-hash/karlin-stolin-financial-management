import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts, useFunds, useExpenseTypes, useCategories, useSubcategories, type Account } from "@/hooks/use-lookups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
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
  credit?: number | null;
  debit?: number | null;
  association?: string | null;
  future_check?: boolean | null;
  operation_type?: string | null;
  payee?: string | null;
};

type SchemaType = Account["schema_type"];

type FormValues = {
  account_id: string;
  transaction_date: string;
  value_date: string;
  direction: "credit" | "debit";
  amount: string;
  description: string;
  reference: string;
  fee: string;
  channel: string;
  operation_type: string;
  payee: string;
  association: string;
  future_check: boolean;
  fund_id: string;
  expense_type_id: string;
  category_id: string;
  subcategory_id: string;
  note: string;
};

export function TransactionDialog({
  open, onOpenChange, initial, account, lockAccount = false,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: TransactionRow | null;
  account?: Account | null;
  lockAccount?: boolean;
}) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const { data: funds = [] } = useFunds();
  const { data: expTypes = [] } = useExpenseTypes();
  const { data: cats = [] } = useCategories();
  const { data: subs = [] } = useSubcategories();

  // Determine the active account (for schema-driven fields)
  const activeAccountId = initial?.account_id ?? account?.id ?? "";
  const activeAccount: Account | null =
    accounts.find((a) => a.id === activeAccountId) ?? account ?? null;
  const schema: SchemaType = activeAccount?.schema_type ?? "mercantile";

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: getDefaults(initial, activeAccountId),
  });

  useEffect(() => {
    if (open) reset(getDefaults(initial, activeAccountId));
  }, [open, initial, activeAccountId, reset]);




  const direction = watch("direction");
  const catId = watch("category_id");
  const filteredSubs = subs.filter((s) => !s.category_id || s.category_id === catId);

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const amtNum = Number(v.amount);
      if (isNaN(amtNum) || amtNum <= 0) throw new Error("יש להזין סכום חיובי");

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id;

      // Build per-schema payload
      const base: any = {
        account_id: v.account_id,
        transaction_date: v.transaction_date,
        value_date: v.value_date || null,
        description: v.description || null,
        fund_id: v.fund_id === NULL_VALUE || !v.fund_id ? null : v.fund_id,
        expense_type_id: v.expense_type_id === NULL_VALUE || !v.expense_type_id ? null : v.expense_type_id,
        category_id: v.category_id === NULL_VALUE || !v.category_id ? null : v.category_id,
        subcategory_id: v.subcategory_id === NULL_VALUE || !v.subcategory_id ? null : v.subcategory_id,
        note: v.note || null,
        updated_by: userId,
      };

      if (schema === "checks") {
        base.payee = v.payee || null;
        base.association = v.association || null;
        base.amount = Math.abs(amtNum);
        base.future_check = !!v.future_check;
      } else if (schema === "cash") {
        const signed = v.direction === "debit" ? -Math.abs(amtNum) : Math.abs(amtNum);
        base.amount = signed;
        base.credit = v.direction === "credit" ? Math.abs(amtNum) : null;
        base.debit = v.direction === "debit" ? Math.abs(amtNum) : null;
      } else if (schema === "pagi") {
        const signed = v.direction === "debit" ? -Math.abs(amtNum) : Math.abs(amtNum);
        base.amount = signed;
        base.credit = v.direction === "credit" ? Math.abs(amtNum) : null;
        base.debit = v.direction === "debit" ? Math.abs(amtNum) : null;
        base.reference = v.reference || null;
        base.operation_type = v.operation_type || null;
      } else {
        // mercantile
        const signed = v.direction === "debit" ? -Math.abs(amtNum) : Math.abs(amtNum);
        base.amount = signed;
        base.credit = v.direction === "credit" ? Math.abs(amtNum) : null;
        base.debit = v.direction === "debit" ? Math.abs(amtNum) : null;
        base.reference = v.reference || null;
        base.fee = v.fee ? Number(v.fee) : null;
        base.channel = v.channel || null;
      }

      if (initial) {
        const { error } = await supabase.from("transactions").update(base).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert({ ...base, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "תנועה עודכנה" : "תנועה נוספה");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["uncategorized-count"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  const schemaLabel = ({ mercantile: "מרכנתיל", pagi: "פאגי", checks: "צ׳קים", cash: "מזומן" } as const)[schema];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {initial ? "עריכת תנועה" : "תנועה חדשה"}
            {activeAccount && (
              <span className="text-xs font-normal text-muted-foreground">· {activeAccount.name}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {!lockAccount && (
            <Field label="חשבון">
              <Select value={watch("account_id")} onValueChange={(v) => setValue("account_id", v)}>
                <SelectTrigger><SelectValue placeholder="בחר חשבון" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="תאריך">
            <Input type="date" {...register("transaction_date", { required: true })} dir="ltr" />
          </Field>

          {schema !== "cash" && (
            <Field label={schema === "pagi" ? "תאריך ערך" : "יום ערך"}>
              <Input type="date" {...register("value_date")} dir="ltr" />
            </Field>
          )}

          {/* Direction + Amount */}
          {schema === "checks" ? (
            <Field label="סכום ₪">
              <Input type="number" step="0.01" min="0" dir="ltr" {...register("amount", { required: true })} />
            </Field>
          ) : (
            <>
              <Field label="סוג פעולה">
                <ToggleGroup type="single" value={direction} onValueChange={(v) => v && setValue("direction", v as any)} className="w-full">
                  <ToggleGroupItem value="credit" className="flex-1 data-[state=on]:bg-income data-[state=on]:text-success-foreground">זכות / הכנסה</ToggleGroupItem>
                  <ToggleGroupItem value="debit" className="flex-1 data-[state=on]:bg-expense data-[state=on]:text-destructive-foreground">חובה / הוצאה</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field label="סכום ₪">
                <Input type="number" step="0.01" min="0" dir="ltr" {...register("amount", { required: true })} />
              </Field>
            </>
          )}

          {/* Schema-specific text fields */}
          {schema === "checks" ? (
            <>
              <Field label="שם">
                <Input {...register("payee")} />
              </Field>
              <Field label="עמותה">
                <Input {...register("association")} />
              </Field>
            </>
          ) : (
            <Field label={schema === "cash" ? "פירוט" : (schema === "pagi" ? "תאור" : "תיאור התנועה")} full>
              <Input {...register("description")} />
            </Field>
          )}

          {(schema === "mercantile" || schema === "pagi") && (
            <Field label={schema === "pagi" ? "אסמכתא" : "אסמכתה"}>
              <Input {...register("reference")} dir="ltr" />
            </Field>
          )}

          {schema === "pagi" && (
            <Field label="סוג פעולה (טקסט)">
              <Input {...register("operation_type")} placeholder="העברה / משיכה / הפקדה…" />
            </Field>
          )}

          {schema === "mercantile" && (
            <>
              <Field label="עמלה ₪">
                <Input type="number" step="0.01" dir="ltr" {...register("fee")} />
              </Field>
              <Field label="ערוץ ביצוע">
                <Input {...register("channel")} placeholder="אינטרנט / סניף / יזום מחשב…" />
              </Field>
            </>
          )}

          {/* Classification (common) */}
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
      value_date: "",
      direction: "debit",
      amount: "",
      description: "",
      reference: "",
      fee: "",
      channel: "",
      operation_type: "",
      payee: "",
      association: "",
      future_check: false,
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
    value_date: initial.value_date ?? "",
    direction: Number(initial.amount) >= 0 ? "credit" : "debit",
    amount: String(Math.abs(Number(initial.amount))),
    description: initial.description ?? "",
    reference: initial.reference ?? "",
    fee: initial.fee == null ? "" : String(initial.fee),
    channel: initial.channel ?? "",
    operation_type: initial.operation_type ?? "",
    payee: initial.payee ?? "",
    association: initial.association ?? "",
    future_check: !!initial.future_check,
    fund_id: initial.fund_id ?? NULL_VALUE,
    expense_type_id: initial.expense_type_id ?? NULL_VALUE,
    category_id: initial.category_id ?? NULL_VALUE,
    subcategory_id: initial.subcategory_id ?? NULL_VALUE,
    note: initial.note ?? "",
  };
}
