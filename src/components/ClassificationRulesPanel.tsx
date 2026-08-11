import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { splitTerms } from "@/lib/classification-match";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Play, Eye, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAccounts, useCategories, useSubcategories, useExpenseTypes, useFunds } from "@/hooks/use-lookups";
import { useUserRole } from "@/hooks/use-auth";
import {
  previewClassificationRules,
  applyClassificationRules,
  listPendingSuggestions,
  resolveSuggestion,
} from "@/lib/classification.functions";

const NONE = "__none__";

type RuleForm = {
  id?: string;
  name: string;
  mode: "auto" | "suggest";
  priority: number;
  match_field: "payee" | "description" | "reference" | "any";
  match_text: string;
  match_whole_word: boolean;
  match_smart: boolean;
  account_id: string;
  amount_min: string;
  amount_max: string;
  set_fund_id: string;
  set_expense_type_id: string;
  set_category_id: string;
  set_subcategory_id: string;
};

const EMPTY: RuleForm = {
  name: "",
  mode: "suggest",
  priority: 100,
  match_field: "payee",
  match_text: "",
  match_whole_word: true,
  match_smart: false,
  account_id: NONE,
  amount_min: "",
  amount_max: "",
  set_fund_id: NONE,
  set_expense_type_id: NONE,
  set_category_id: NONE,
  set_subcategory_id: NONE,
};

const FIELD_LABELS: Record<string, string> = {
  payee: "שם מוטב",
  description: "תיאור",
  reference: "אסמכתא",
  any: "כל שדה",
};

function nullable(v: string) {
  return v && v !== NONE ? v : null;
}

export function ClassificationRulesPanel() {
  const qc = useQueryClient();
  const { data: role } = useUserRole();
  const canEdit = !!role?.isAdmin;

  const { data: accounts = [] } = useAccounts();
  const { data: funds = [] } = useFunds();
  const { data: expenseTypes = [] } = useExpenseTypes();
  const { data: categories = [] } = useCategories();
  const { data: subcategories = [] } = useSubcategories();

  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    [...accounts, ...funds, ...expenseTypes, ...categories, ...subcategories].forEach((r: any) =>
      map.set(r.id, r.name),
    );
    return map;
  }, [accounts, funds, expenseTypes, categories, subcategories]);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["classification-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classification_rules")
        .select("*")
        .order("priority")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY);
  const [preview, setPreview] = useState<any | null>(null);
  const [allTx, setAllTx] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  const runPreview = useServerFn(previewClassificationRules);
  const runApply = useServerFn(applyClassificationRules);

  const save = useMutation({
    mutationFn: async (f: RuleForm) => {
      const payload = {
        name: f.name.trim(),
        mode: f.mode,
        priority: Number(f.priority) || 100,
        match_field: f.match_field,
        match_text: f.match_text.trim() || null,
        match_whole_word: f.match_whole_word,
        match_smart: f.match_smart,

        account_id: nullable(f.account_id),
        amount_min: f.amount_min === "" ? null : Number(f.amount_min),
        amount_max: f.amount_max === "" ? null : Number(f.amount_max),
        set_fund_id: nullable(f.set_fund_id),
        set_expense_type_id: nullable(f.set_expense_type_id),
        set_category_id: nullable(f.set_category_id),
        set_subcategory_id: nullable(f.set_subcategory_id),
      };
      if (!payload.name) throw new Error("יש להזין שם לכלל");
      if (
        !payload.set_fund_id &&
        !payload.set_expense_type_id &&
        !payload.set_category_id &&
        !payload.set_subcategory_id
      ) {
        throw new Error("יש לבחור לפחות ערך אחד לסיווג");
      }
      const { error } = f.id
        ? await supabase.from("classification_rules").update(payload).eq("id", f.id)
        : await supabase.from("classification_rules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הכלל נשמר");
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["classification-rules"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שמירה נכשלה"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("classification_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classification-rules"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classification_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הכלל נמחק");
      qc.invalidateQueries({ queryKey: ["classification-rules"] });
    },
  });

  const previewMut = useMutation({
    mutationFn: async (ruleId?: string) =>
      runPreview({ data: { ruleId, onlyUnclassified: !allTx, overwrite } }),
    onSuccess: (res) => setPreview(res),
    onError: (e: any) => toast.error(e?.message ?? "התצוגה המקדימה נכשלה"),
  });

  const applyMut = useMutation({
    mutationFn: async (ruleId?: string) =>
      runApply({ data: { ruleId, onlyUnclassified: !allTx, overwrite } }),
    onSuccess: (res: any) => {
      toast.success(
        `סווגו ${res.applied} תנועות, נוצרו ${res.suggested} הצעות, ${res.skipped ?? 0} דולגו (השדה כבר מלא)`,
      );
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["classification-rules"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
      qc.invalidateQueries({ queryKey: ["classification-suggestions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "ההרצה נכשלה"),
  });

  function edit(rule: any) {
    setForm({
      id: rule.id,
      name: rule.name,
      mode: rule.mode,
      priority: rule.priority,
      match_field: rule.match_field,
      match_text: rule.match_text ?? "",
      match_whole_word: rule.match_whole_word ?? true,
      match_smart: rule.match_smart ?? false,

      account_id: rule.account_id ?? NONE,
      amount_min: rule.amount_min ?? "",
      amount_max: rule.amount_max ?? "",
      set_fund_id: rule.set_fund_id ?? NONE,
      set_expense_type_id: rule.set_expense_type_id ?? NONE,
      set_category_id: rule.set_category_id ?? NONE,
      set_subcategory_id: rule.set_subcategory_id ?? NONE,
    });
    setOpen(true);
  }

  const subsForCat = useMemo(
    () =>
      form.set_category_id && form.set_category_id !== NONE
        ? subcategories.filter((s: any) => s.category_id === form.set_category_id)
        : subcategories,
    [subcategories, form.set_category_id],
  );

  return (
    <Tabs defaultValue="rules" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rules">כללים</TabsTrigger>
        <TabsTrigger value="suggestions">הצעות לאישור</TabsTrigger>
      </TabsList>

      <TabsContent value="rules">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">כללי סיווג אוטומטיים</CardTitle>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => previewMut.mutate(undefined)} disabled={previewMut.isPending}>
                  <Eye className="w-4 h-4 ml-1" />
                  {previewMut.isPending ? "בודק…" : "תצוגה מקדימה"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => applyMut.mutate(undefined)} disabled={applyMut.isPending}>
                  <Play className="w-4 h-4 ml-1" />
                  {applyMut.isPending ? "מריץ…" : "הרץ על היסטוריה"}
                </Button>
                <Button size="sm" onClick={() => { setForm(EMPTY); setOpen(true); }}>
                  <Plus className="w-4 h-4 ml-1" />
                  כלל חדש
                </Button>
              </div>
          </CardHeader>
          <CardContent>
            {canEdit && (
              <div className="mb-4 flex flex-wrap items-center gap-6 rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <Switch id="cls-all" checked={allTx} onCheckedChange={setAllTx} />
                  <Label htmlFor="cls-all" className="text-sm">החל על כל התנועות (לא רק לא-מסווגות)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="cls-ovr" checked={overwrite} onCheckedChange={setOverwrite} />
                  <Label htmlFor="cls-ovr" className="text-sm">דרוס ערך קיים</Label>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">טוען…</div>
            ) : rules.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                אין עדיין כללים. כלל אחד יכול לסווג מאות תנועות בבת אחת.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="[&_td]:border [&_th]:border">
                  <TableHeader>
                    <TableRow>
                      <TableHead>פעיל</TableHead>
                      <TableHead>שם</TableHead>
                      <TableHead>תנאי</TableHead>
                      <TableHead>מסווג ל־</TableHead>
                      <TableHead>מצב</TableHead>
                      <TableHead>עדיפות</TableHead>
                      <TableHead>סווגו</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rules as any[]).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Switch
                            checked={r.is_active}
                            disabled={!canEdit}
                            onCheckedChange={(v) => toggleActive.mutate({ id: r.id, is_active: v })}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.match_text
                            ? `${FIELD_LABELS[r.match_field]}: ${splitTerms(r.match_text).join(" / ")}`
                            : "כל התנועות"}
                          {r.match_text && r.match_whole_word ? " · מילה שלמה" : ""}
                          {r.match_text && r.match_smart ? " · התאמה חכמה" : ""}
                          {r.account_id ? ` · ${nameOf.get(r.account_id) ?? ""}` : ""}
                          {r.amount_min != null || r.amount_max != null
                            ? ` · סכום ${r.amount_min ?? "0"}–${r.amount_max ?? "∞"}`
                            : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {[r.set_fund_id, r.set_expense_type_id, r.set_category_id, r.set_subcategory_id]
                            .filter(Boolean)
                            .map((id: string) => nameOf.get(id) ?? "")
                            .join(" · ")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.mode === "auto" ? "default" : "secondary"}>
                            {r.mode === "auto" ? "אוטומטי" : "הצעה לאישור"}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.priority}</TableCell>
                        <TableCell>{r.applied_count}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => previewMut.mutate(r.id)} title="תצוגה מקדימה">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => edit(r)} title="עריכה">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)} title="מחיקה">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="suggestions">
        <SuggestionsList nameOf={nameOf} canEdit={canEdit} />
      </TabsContent>

      {/* Rule editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "עריכת כלל" : "כלל סיווג חדש"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>שם הכלל</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="למשל: חשמל → הוצאות תפעול" />
            </div>
            <div className="space-y-2">
              <Label>שדה לבדיקה</Label>
              <Select value={form.match_field} onValueChange={(v: any) => setForm({ ...form, match_field: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>מילים להתאמה</Label>
              <Textarea
                rows={2}
                value={form.match_text}
                onChange={(e) => setForm({ ...form, match_text: e.target.value })}
                placeholder="עמלה, עמלת, עמלות"
              />
              <p className="text-xs text-muted-foreground">
                אפשר להזין כמה מילים מופרדות בפסיק — הכלל יתפוס תנועה שמכילה לפחות אחת מהן.
              </p>
            </div>
            <div className="space-y-3 sm:col-span-2 rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="font-medium">מילה שלמה בלבד</Label>
                  <p className="text-xs text-muted-foreground">
                    תופס את המילה רק כשהיא עומדת בפני עצמה, ולא כשהיא מודבקת לאותיות אחרות.
                  </p>
                </div>
                <Switch
                  checked={form.match_whole_word}
                  onCheckedChange={(v) => setForm({ ...form, match_whole_word: v })}
                />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="font-medium">התאמה חכמה (הטיות)</Label>
                  <p className="text-xs text-muted-foreground">
                    יתפוס גם הטיות של המילה — "עמלה" יתפוס גם "עמלת", "עמלות" ו"העמלה".
                  </p>
                </div>
                <Switch
                  checked={form.match_smart}
                  onCheckedChange={(v) => setForm({ ...form, match_smart: v })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>חשבון (אופציונלי)</Label>
              <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>כל החשבונות</SelectItem>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>סכום מ־</Label>
                <Input type="number" dir="ltr" value={form.amount_min} onChange={(e) => setForm({ ...form, amount_min: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>סכום עד</Label>
                <Input type="number" dir="ltr" value={form.amount_max} onChange={(e) => setForm({ ...form, amount_max: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>קופה</Label>
              <Select value={form.set_fund_id} onValueChange={(v) => setForm({ ...form, set_fund_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא שינוי</SelectItem>
                  {funds.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סוג הוצאה</Label>
              <Select value={form.set_expense_type_id} onValueChange={(v) => setForm({ ...form, set_expense_type_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא שינוי</SelectItem>
                  {expenseTypes.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>קטגוריה</Label>
              <Select value={form.set_category_id} onValueChange={(v) => setForm({ ...form, set_category_id: v, set_subcategory_id: NONE })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא שינוי</SelectItem>
                  {categories.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>תת-קטגוריה</Label>
              <Select value={form.set_subcategory_id} onValueChange={(v) => setForm({ ...form, set_subcategory_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>ללא שינוי</SelectItem>
                  {subsForCat.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>אופן הפעולה</Label>
              <Select value={form.mode} onValueChange={(v: any) => setForm({ ...form, mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">סיווג אוטומטי מלא</SelectItem>
                  <SelectItem value="suggest">הצעה לאישור</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>עדיפות (מספר נמוך = קודם)</Label>
              <Input type="number" dir="ltr" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "שומר…" : "שמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>תצוגה מקדימה</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <Badge variant="default">יסווגו אוטומטית: {preview.applied}</Badge>
                <Badge variant="secondary">יוצעו לאישור: {preview.suggested}</Badge>
              </div>
              {preview.sample.length > 0 && (
                <div className="overflow-x-auto">
                  <Table className="[&_td]:border [&_th]:border">
                    <TableHeader>
                      <TableRow>
                        <TableHead>שם מוטב</TableHead>
                        <TableHead>תיאור</TableHead>
                        <TableHead>כלל</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sample.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.payee ?? ""}</TableCell>
                          <TableCell className="max-w-xs truncate">{s.description ?? ""}</TableCell>
                          <TableCell>{s.rule}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="mt-2 text-xs text-muted-foreground">מוצגות עד 25 דוגמאות ראשונות.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>סגירה</Button>
            <Button onClick={() => applyMut.mutate(undefined)} disabled={applyMut.isPending}>
              {applyMut.isPending ? "מריץ…" : "החל עכשיו"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function SuggestionsList({ nameOf, canEdit }: { nameOf: Map<string, string>; canEdit: boolean }) {
  const qc = useQueryClient();
  const fetchSuggestions = useServerFn(listPendingSuggestions);
  const resolve = useServerFn(resolveSuggestion);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["classification-suggestions"],
    queryFn: () => fetchSuggestions(),
  });

  const act = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => resolve({ data: { id, accept } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classification-suggestions"] });
      qc.invalidateQueries({ queryKey: ["tx-all"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "הפעולה נכשלה"),
  });

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">טוען…</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">הצעות סיווג ממתינות ({(rows as any[]).length})</CardTitle>
      </CardHeader>
      <CardContent>
        {(rows as any[]).length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">אין הצעות ממתינות.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="[&_td]:border [&_th]:border">
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>שם מוטב</TableHead>
                  <TableHead>תיאור</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>ההצעה</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as any[]).map((s) => {
                  const tx = s.transaction ?? {};
                  const rule = s.rule ?? {};
                  const targets = [rule.set_fund_id, rule.set_expense_type_id, rule.set_category_id, rule.set_subcategory_id]
                    .filter(Boolean)
                    .map((id: string) => nameOf.get(id) ?? "")
                    .join(" · ");
                  return (
                    <TableRow key={s.id}>
                      <TableCell dir="ltr">{tx.transaction_date ?? tx.value_date ?? ""}</TableCell>
                      <TableCell>{tx.payee ?? ""}</TableCell>
                      <TableCell className="max-w-xs truncate">{tx.description ?? ""}</TableCell>
                      <TableCell dir="ltr">{tx.amount}</TableCell>
                      <TableCell>{targets} <span className="text-xs text-muted-foreground">({rule.name})</span></TableCell>
                      <TableCell className="whitespace-nowrap">
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => act.mutate({ id: s.id, accept: true })} title="אישור">
                              <Check className="w-4 h-4 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => act.mutate({ id: s.id, accept: false })} title="דחייה">
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
