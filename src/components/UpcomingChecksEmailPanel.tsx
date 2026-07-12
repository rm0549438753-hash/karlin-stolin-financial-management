import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Mail, CheckCircle2, XCircle, CircleSlash, ChevronDown, ChevronLeft, Trash2, RefreshCw, Eye, X, Plus } from "lucide-react";
import {
  triggerChecksEmailNow,
  listChecksEmailRuns,
  deleteChecksEmailRun,
  rerunChecksEmail,
  getChecksEmailSettings,
  updateChecksEmailSettings,
  previewChecksEmailFn,
} from "@/lib/checks-email.functions";

const SENDER = "RM0549438753@gmail.com";

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("he-IL");
}
function fmtDateOnly(v: string | null) {
  if (!v) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}
function fmtAmt(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

const PLACEHOLDERS = [
  { key: "{{date}}", desc: "תאריך (dd/mm/yyyy)" },
  { key: "{{day_name}}", desc: "יום בשבוע (למשל: יום שני)" },
  { key: "{{count}}", desc: "מספר הצ'קים" },
  { key: "{{total}}", desc: "סה\"כ הסכום" },
  { key: "{{org_name}}", desc: "שם הארגון" },
];

export function UpcomingChecksEmailPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listChecksEmailRuns);
  const trigger = useServerFn(triggerChecksEmailNow);
  const del = useServerFn(deleteChecksEmailRun);
  const rerun = useServerFn(rerunChecksEmail);
  const getSettings = useServerFn(getChecksEmailSettings);
  const saveSettings = useServerFn(updateChecksEmailSettings);
  const preview = useServerFn(previewChecksEmailFn);
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<{ html: string; subject: string; recipients: string[]; count: number; for_date: string } | null>(null);

  // Settings form state
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipient, setNewRecipient] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyIntro, setBodyIntro] = useState("");
  const [bodyOutro, setBodyOutro] = useState("");
  const [includeAssoc, setIncludeAssoc] = useState(true);
  const [includeNote, setIncludeNote] = useState(true);
  const [sendWhenEmpty, setSendWhenEmpty] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["check_email_settings"],
    queryFn: () => getSettings(),
  });

  useEffect(() => {
    if (!settings) return;
    setRecipients(settings.recipients ?? []);
    setSubjectTemplate(settings.subject_template ?? "");
    setBodyIntro(settings.body_intro ?? "");
    setBodyOutro(settings.body_outro ?? "");
    setIncludeAssoc(settings.include_association ?? true);
    setIncludeNote(settings.include_note ?? true);
    setSendWhenEmpty(settings.send_when_empty ?? false);
  }, [settings]);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["check_email_runs"],
    queryFn: () => list(),
    refetchInterval: running ? 3000 : false,
  });

  const runNow = useMutation({
    mutationFn: async () => {
      setRunning(true);
      return await trigger({ data: {} });
    },
    onSuccess: (res: any) => {
      if (res?.ok && res?.sent) toast.success(`המייל נשלח · ${res.count} צ'קים`);
      else if (res?.ok && res?.skipped) toast.info("אין צ'קים למחר — לא נשלח מייל");
      else toast.error(`שגיאה: ${res?.error ?? "לא ידוע"}`);
      qc.invalidateQueries({ queryKey: ["check_email_runs"] });
    },
    onError: (err: any) => toast.error(`שגיאה: ${err?.message ?? err}`),
    onSettled: () => setRunning(false),
  });

  const deleteRun = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("נמחק");
      qc.invalidateQueries({ queryKey: ["check_email_runs"] });
    },
    onError: (err: any) => toast.error(`שגיאה: ${err?.message ?? err}`),
  });

  const rerunFor = useMutation({
    mutationFn: (forDate: string) => rerun({ data: { forDate } }),
    onSuccess: (res: any) => {
      if (res?.ok && res?.sent) toast.success(`נשלח מחדש · ${res.count} צ'קים`);
      else if (res?.ok && res?.skipped) toast.info("אין צ'קים לתאריך זה");
      else toast.error(`שגיאה: ${res?.error ?? "לא ידוע"}`);
      qc.invalidateQueries({ queryKey: ["check_email_runs"] });
    },
    onError: (err: any) => toast.error(`שגיאה: ${err?.message ?? err}`),
  });

  const saveMut = useMutation({
    mutationFn: () => saveSettings({
      data: {
        recipients,
        subject_template: subjectTemplate,
        body_intro: bodyIntro,
        body_outro: bodyOutro,
        include_association: includeAssoc,
        include_note: includeNote,
        send_when_empty: sendWhenEmpty,
      },
    }),
    onSuccess: () => {
      toast.success("ההגדרות נשמרו");
      qc.invalidateQueries({ queryKey: ["check_email_settings"] });
    },
    onError: (err: any) => toast.error(`שגיאה: ${err?.message ?? err}`),
  });

  const previewMut = useMutation({
    mutationFn: (forDate?: string) => preview({ data: forDate ? { forDate } : {} }),
    onSuccess: (res: any) => setPreviewHtml(res),
    onError: (err: any) => toast.error(`שגיאה: ${err?.message ?? err}`),
  });

  const addRecipient = () => {
    const e = newRecipient.trim();
    if (!e || !e.includes("@")) return;
    if (recipients.includes(e)) return;
    setRecipients([...recipients, e]);
    setNewRecipient("");
  };

  const insertPlaceholder = (field: "subject" | "intro" | "outro", ph: string) => {
    if (field === "subject") setSubjectTemplate((s) => s + " " + ph);
    else if (field === "intro") setBodyIntro((s) => s + " " + ph);
    else setBodyOutro((s) => s + " " + ph);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>מייל יומי · צ'קים שיוצאים מחר</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            כל יום ב-10:00 (שעון ישראל) המערכת בודקת אילו צ'קים אמורים לצאת מהבנק
            למחרת (לפי <b>תאריך ערך</b>), ושולחת מייל לפי ההגדרות למטה.
          </p>
          <div className="rounded-md border p-3 bg-muted/30 text-sm">
            <div className="text-xs text-muted-foreground mb-1">שולח מהחשבון</div>
            <div className="font-mono" dir="ltr">{SENDER}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runNow.mutate()} disabled={runNow.isPending || running}>
              {runNow.isPending || running ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> שולח...</>
              ) : (
                <><Mail className="ml-2 h-4 w-4" /> שלח עכשיו לבדיקה</>
              )}
            </Button>
            <Button variant="outline" onClick={() => previewMut.mutate(undefined)} disabled={previewMut.isPending}>
              <Eye className="ml-2 h-4 w-4" /> תצוגה מקדימה
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>הגדרות המייל</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>נמענים</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {recipients.map((r) => (
                <Badge key={r} variant="secondary" className="pr-2 pl-1 py-1 gap-1 font-mono text-xs" dir="ltr">
                  {r}
                  <button type="button" onClick={() => setRecipients(recipients.filter((x) => x !== r))} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                dir="ltr"
                placeholder="email@example.com"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
              />
              <Button type="button" variant="outline" onClick={addRecipient}>
                <Plus className="ml-1 h-4 w-4" /> הוסף
              </Button>
            </div>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-xs">
            <div className="font-medium mb-2">משתנים דינמיים (לחצו כדי להוסיף):</div>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <code key={p.key} className="bg-background px-2 py-1 rounded border text-[11px]" title={p.desc}>
                  {p.key}
                </code>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>נושא המייל</Label>
              <div className="flex gap-1">
                {PLACEHOLDERS.map((p) => (
                  <Button key={p.key} type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => insertPlaceholder("subject", p.key)}>
                    {p.key}
                  </Button>
                ))}
              </div>
            </div>
            <Input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>פסקת פתיחה</Label>
              <div className="flex gap-1">
                {PLACEHOLDERS.map((p) => (
                  <Button key={p.key} type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => insertPlaceholder("intro", p.key)}>
                    {p.key}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea rows={3} value={bodyIntro} onChange={(e) => setBodyIntro(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>פסקת סיום</Label>
              <div className="flex gap-1">
                {PLACEHOLDERS.map((p) => (
                  <Button key={p.key} type="button" variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => insertPlaceholder("outro", p.key)}>
                    {p.key}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea rows={2} value={bodyOutro} onChange={(e) => setBodyOutro(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="incl-assoc" className="text-sm">כלול עמותה</Label>
              <Switch id="incl-assoc" checked={includeAssoc} onCheckedChange={setIncludeAssoc} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="incl-note" className="text-sm">כלול הערה</Label>
              <Switch id="incl-note" checked={includeNote} onCheckedChange={setIncludeNote} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="send-empty" className="text-sm">שלח גם אם אין צ'קים</Label>
              <Switch id="send-empty" checked={sendWhenEmpty} onCheckedChange={setSendWhenEmpty} />
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> שומר...</> : "שמור הגדרות"}
            </Button>
            <Button variant="outline" onClick={() => previewMut.mutate(undefined)} disabled={previewMut.isPending}>
              <Eye className="ml-2 h-4 w-4" /> תצוגה מקדימה
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ריצות אחרונות</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">טוען...</div>
          ) : !runs || runs.length === 0 ? (
            <div className="text-sm text-muted-foreground">עוד לא הופעל.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>תאריך ריצה</TableHead>
                    <TableHead>עבור תאריך</TableHead>
                    <TableHead>צ'קים</TableHead>
                    <TableHead>סה"כ</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs as any[]).map((r) => {
                    const isOpen = openId === r.id;
                    return (
                      <>
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(isOpen ? null : r.id)}>
                          <TableCell>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.status === "sent" ? (
                              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle2 className="h-4 w-4" /> נשלח
                              </span>
                            ) : r.status === "failed" ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                                <XCircle className="h-4 w-4" /> נכשל
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                                <CircleSlash className="h-4 w-4" /> ללא צ'קים
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDate(r.ran_at)}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtDateOnly(r.for_date)}</TableCell>
                          <TableCell>{r.check_count}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtAmt(Number(r.total_amount))}</TableCell>
                          <TableCell>{r.triggered_by === "cron" ? "אוטומטי" : "ידני"}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" title="הרץ שוב לתאריך זה" onClick={() => rerunFor.mutate(r.for_date)} disabled={rerunFor.isPending}>
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" title="מחק" onClick={() => { if (confirm("למחוק את השורה?")) deleteRun.mutate(r.id); }} disabled={deleteRun.isPending}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow key={r.id + "-detail"} className="bg-muted/40">
                            <TableCell colSpan={8}>
                              <div className="p-3 space-y-2 text-sm">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div><div className="text-xs text-muted-foreground">ID</div><div className="font-mono text-xs" dir="ltr">{r.id}</div></div>
                                  <div><div className="text-xs text-muted-foreground">סטטוס</div><div>{r.status}</div></div>
                                  <div><div className="text-xs text-muted-foreground">עבור תאריך</div><div>{fmtDateOnly(r.for_date)}</div></div>
                                  <div><div className="text-xs text-muted-foreground">רץ ב-</div><div>{fmtDate(r.ran_at)}</div></div>
                                  <div><div className="text-xs text-muted-foreground">מספר צ'קים</div><div>{r.check_count}</div></div>
                                  <div><div className="text-xs text-muted-foreground">סה"כ סכום</div><div>{fmtAmt(Number(r.total_amount))}</div></div>
                                  <div><div className="text-xs text-muted-foreground">מקור</div><div>{r.triggered_by === "cron" ? "אוטומטי" : "ידני"}</div></div>
                                </div>
                                {r.error_message && (
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">פרטי שגיאה</div>
                                    <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                                      {r.error_message}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewHtml} onOpenChange={(o) => { if (!o) setPreviewHtml(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>תצוגה מקדימה של המייל</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <div className="flex-1 overflow-y-auto space-y-3">
              <div className="rounded-md border p-3 bg-muted/30 text-sm space-y-1">
                <div><b>נושא:</b> {previewHtml.subject}</div>
                <div><b>נמענים:</b> <span className="font-mono text-xs" dir="ltr">{previewHtml.recipients.join(", ")}</span></div>
                <div><b>עבור תאריך:</b> {fmtDateOnly(previewHtml.for_date)} · <b>צ'קים:</b> {previewHtml.count}</div>
              </div>
              <iframe
                srcDoc={previewHtml.html}
                className="w-full border rounded-md bg-white"
                style={{ height: "60vh" }}
                title="Email preview"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
