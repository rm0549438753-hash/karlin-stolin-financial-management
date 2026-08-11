import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Mail, Plus, Send, Eye, Trash2, Pencil, Copy } from "lucide-react";
import { toast } from "sonner";

const TRIGGERS = [
  { value: "checks_due", label: "צ'קים לפירעון בימים הקרובים" },
  { value: "period_summary", label: "סיכום תקופתי (הכנסות מול הוצאות)" },
  { value: "negative_balance", label: "התראה על יתרה שלילית בחשבון" },
  { value: "low_cash", label: "יתרת מזומן מתחת לסף" },
  { value: "uncategorized", label: "הצטברות תנועות לא מסווגות" },
] as const;

const FREQUENCIES = [
  { value: "daily", label: "יומי" },
  { value: "weekly", label: "שבועי (יום ראשון)" },
  { value: "monthly", label: "חודשי (ה-1 בחודש)" },
] as const;

type Automation = {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  frequency: string;
  send_hour: number;
  recipients: string[];
  threshold_value: number | null;
  days_ahead: number | null;
  subject_template: string;
  body_intro: string;
  body_outro: string;
  send_when_empty: boolean;
  last_run_at: string | null;
};

const EMPTY: Partial<Automation> = {
  name: "",
  is_active: true,
  trigger_type: "checks_due",
  frequency: "daily",
  send_hour: 7,
  recipients: [],
  threshold_value: null,
  days_ahead: 3,
  subject_template: "{{org_name}} — עדכון {{date}}",
  body_intro: "שלום,\nלהלן העדכון ליום {{date}}:",
  body_outro: "בברכה,\n{{org_name}}",
  send_when_empty: false,
};

function triggerLabel(v: string) {
  return TRIGGERS.find((t) => t.value === v)?.label ?? v;
}

export function EmailAutomationsPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Automation> | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string; recipients: string[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["email-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Automation[];
    },
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["email-automation-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_automation_runs")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const runsByAutomation = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of runs as any[]) {
      const k = r.automation_id ?? "—";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [runs]);

  const save = useMutation({
    mutationFn: async (a: Partial<Automation>) => {
      const payload = {
        name: a.name?.trim() || "אוטומציה",
        is_active: a.is_active ?? true,
        trigger_type: a.trigger_type!,
        frequency: a.frequency!,
        send_hour: Number(a.send_hour ?? 7),
        recipients: a.recipients ?? [],
        threshold_value: a.threshold_value ?? null,
        days_ahead: a.days_ahead ?? null,
        subject_template: a.subject_template ?? "",
        body_intro: a.body_intro ?? "",
        body_outro: a.body_outro ?? "",
        send_when_empty: a.send_when_empty ?? false,
      };
      const q = a.id
        ? supabase.from("email_automations").update(payload).eq("id", a.id)
        : supabase.from("email_automations").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("האוטומציה נשמרה");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["email-automations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שמירה נכשלה"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("email_automations").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-automations"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("האוטומציה נמחקה");
      qc.invalidateQueries({ queryKey: ["email-automations"] });
    },
  });

  async function doPreview(id: string) {
    setBusyId(id);
    try {
      const { previewAutomationFn } = await import("@/lib/automations.functions");
      const res = await previewAutomationFn({ data: { id } });
      setPreview(res as any);
    } catch (e: any) {
      toast.error(e?.message ?? "התצוגה נכשלה");
    } finally {
      setBusyId(null);
    }
  }

  async function doSend(id: string) {
    setBusyId(id);
    try {
      const { sendAutomationNow } = await import("@/lib/automations.functions");
      const res: any = await sendAutomationNow({ data: { id } });
      const status = res?.results?.[0]?.status;
      if (status === "sent") toast.success("המייל נשלח");
      else if (status === "skipped") toast.info("אין נתונים לשליחה — לא נשלח מייל");
      else toast.error(res?.results?.[0]?.error ?? "השליחה נכשלה");
      qc.invalidateQueries({ queryKey: ["email-automation-runs"] });
      qc.invalidateQueries({ queryKey: ["email-automations"] });
    } catch (e: any) {
      toast.error(e?.message ?? "השליחה נכשלה");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4" /> אוטומציות מייל למנהלים
          </CardTitle>
          <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="w-4 h-4 ml-1" /> אוטומציה חדשה
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            כל אוטומציה נבדקת מדי שעה ונשלחת בשעה שהוגדרה. אפשר להשתמש בתגיות{" "}
            <code className="text-xs">{"{{date}}"}</code>, <code className="text-xs">{"{{count}}"}</code>,{" "}
            <code className="text-xs">{"{{total}}"}</code>, <code className="text-xs">{"{{org_name}}"}</code>.
          </p>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">טוען…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">עדיין לא הוגדרו אוטומציות.</div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">פעיל</TableHead>
                    <TableHead className="text-right">שם</TableHead>
                    <TableHead className="text-right">סוג</TableHead>
                    <TableHead className="text-right">תדירות</TableHead>
                    <TableHead className="text-right">שעה</TableHead>
                    <TableHead className="text-right">נמענים</TableHead>
                    <TableHead className="text-right">הרצה אחרונה</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Switch
                          checked={a.is_active}
                          onCheckedChange={(v) => toggle.mutate({ id: a.id, is_active: v })}
                        />
                      </TableCell>
                      <TableCell className="font-semibold">{a.name}</TableCell>
                      <TableCell className="text-sm">{triggerLabel(a.trigger_type)}</TableCell>
                      <TableCell className="text-sm">
                        {FREQUENCIES.find((f) => f.value === a.frequency)?.label ?? a.frequency}
                      </TableCell>
                      <TableCell>{String(a.send_hour).padStart(2, "0")}:00</TableCell>
                      <TableCell className="text-xs max-w-48 truncate">{(a.recipients ?? []).join(", ") || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {a.last_run_at ? new Date(a.last_run_at).toLocaleString("he-IL") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="עריכה" onClick={() => setEditing(a)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="תצוגה מקדימה" disabled={busyId === a.id} onClick={() => doPreview(a.id)}>
                            {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="שכפול" onClick={() => setEditing({ ...a, id: undefined, name: `${a.name} - עותק`, is_active: false })}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="שלח עכשיו" disabled={busyId === a.id} onClick={() => doSend(a.id)}>
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="מחיקה" onClick={() => remove.mutate(a.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">היסטוריית שליחות</CardTitle></CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-sm text-muted-foreground">אין עדיין שליחות.</div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">מועד</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">נמענים</TableHead>
                    <TableHead className="text-right">פירוט</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.ran_at).toLocaleString("he-IL")}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                          {r.status === "sent" ? "נשלח" : r.status === "failed" ? "נכשל" : "דולג"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{(r.recipients ?? []).join(", ") || "—"}</TableCell>
                      <TableCell className="text-xs">{r.error_message ?? r.summary ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "עריכת אוטומציה" : "אוטומציה חדשה"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>שם</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>סוג התראה</Label>
                  <Select value={editing.trigger_type} onValueChange={(v) => setEditing({ ...editing, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>תדירות</Label>
                  <Select value={editing.frequency} onValueChange={(v) => setEditing({ ...editing, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>שעת שליחה</Label>
                  <Input
                    type="number" min={0} max={23}
                    value={editing.send_hour ?? 7}
                    onChange={(e) => setEditing({ ...editing, send_hour: Number(e.target.value) })}
                  />
                </div>
                {editing.trigger_type === "checks_due" && (
                  <div className="space-y-1">
                    <Label>כמה ימים קדימה</Label>
                    <Input
                      type="number" min={0}
                      value={editing.days_ahead ?? 3}
                      onChange={(e) => setEditing({ ...editing, days_ahead: Number(e.target.value) })}
                    />
                  </div>
                )}
                {(editing.trigger_type === "low_cash" ||
                  editing.trigger_type === "negative_balance" ||
                  editing.trigger_type === "uncategorized") && (
                  <div className="space-y-1">
                    <Label>
                      {editing.trigger_type === "uncategorized" ? "סף מספר תנועות" : "סף סכום (₪)"}
                    </Label>
                    <Input
                      type="number"
                      value={editing.threshold_value ?? 0}
                      onChange={(e) => setEditing({ ...editing, threshold_value: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>נמענים (מופרדים בפסיק)</Label>
                <Input
                  value={(editing.recipients ?? []).join(", ")}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      recipients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="name@example.com, name2@example.com"
                />
              </div>

              <div className="space-y-1">
                <Label>נושא המייל</Label>
                <Input value={editing.subject_template ?? ""} onChange={(e) => setEditing({ ...editing, subject_template: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>פתיח</Label>
                <Textarea rows={3} value={editing.body_intro ?? ""} onChange={(e) => setEditing({ ...editing, body_intro: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>סיום</Label>
                <Textarea rows={2} value={editing.body_outro ?? ""} onChange={(e) => setEditing({ ...editing, body_outro: e.target.value })} />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.send_when_empty ?? false}
                  onCheckedChange={(v) => setEditing({ ...editing, send_when_empty: v })}
                />
                <Label>לשלוח גם כשאין נתונים</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>
              {save.isPending && <Loader2 className="w-4 h-4 ml-1 animate-spin" />} שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>תצוגה מקדימה</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-2">
              <div className="text-sm"><b>נושא:</b> {preview.subject}</div>
              <div className="text-sm"><b>נמענים:</b> {preview.recipients.join(", ") || "—"}</div>
              <iframe title="preview" srcDoc={preview.html} className="w-full h-[60vh] border rounded-lg bg-white" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
