import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellRing, ChevronDown, ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NotificationDiagnostics } from "@/components/NotificationDiagnostics";
import { NotificationSimulator } from "@/components/NotificationSimulator";

const TABLE = "push_notification_rules" as any;

const TRIGGERS: { value: string; label: string; hint: string }[] = [
  { value: "checks_due", label: "צ׳קים לפירעון", hint: "התראה לפני תאריך הפירעון של צ׳קים" },
  { value: "uncategorized", label: "תנועות לא מסווגות", hint: "תזכורת יומית כשיש תנועות ללא סוג/קופה" },
  { value: "no_date", label: "תנועות ללא תאריך", hint: "תזכורת יומית כשיש תנועות בלי תאריך" },
];

type Rule = {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  days_before: number;
  send_hour: number;
  send_minute: number;
  min_amount: number | null;
  title_template: string;
  body_template: string;
  link: string;
  link_label: string | null;
  sort_order: number;
};

const EMPTY: Partial<Rule> = {
  name: "התראה חדשה",
  is_active: true,
  trigger_type: "checks_due",
  days_before: 1,
  send_hour: 7,
  send_minute: 0,
  min_amount: null,
  title_template: "{count} צ׳קים לפירעון ב-{date}",
  body_template: 'סה"כ {total}. מומלץ לוודא כיסוי בחשבון.',
  link: "/reports?tab=future-checks",
  link_label: "לפירוט",
};

function triggerLabel(v: string) {
  return TRIGGERS.find((t) => t.value === v)?.label ?? v;
}

export function PushNotificationsPanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["push-notification-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABLE).select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Rule[];
    },
  });

  async function saveEditing() {
    if (!editing) return;
    const payload = {
      name: editing.name?.trim() || "התראה",
      is_active: editing.is_active ?? true,
      trigger_type: editing.trigger_type!,
      days_before: Number(editing.days_before ?? 1),
      send_hour: Number(editing.send_hour ?? 7),
      send_minute: Number(editing.send_minute ?? 0),
      min_amount: editing.min_amount ?? null,
      title_template: editing.title_template ?? "",
      body_template: editing.body_template ?? "",
      link: editing.link ?? "",
      link_label: (editing.link_label ?? "").trim() || "לפירוט",
      sort_order: editing.sort_order ?? rules.length,
    };
    const q = editing.id
      ? supabase.from(TABLE).update(payload as any).eq("id", editing.id)
      : supabase.from(TABLE).insert(payload as any);
    const { error } = await q;
    if (error) return toast.error("שמירה נכשלה: " + error.message);
    setEditing(null);
    await qc.invalidateQueries({ queryKey: ["push-notification-rules"] });
    toast.success("ההתראה נשמרה");
  }

  async function toggle(rule: Rule, is_active: boolean) {
    const { error } = await supabase.from(TABLE).update({ is_active } as any).eq("id", rule.id);
    if (error) return toast.error("עדכון נכשל: " + error.message);
    await qc.invalidateQueries({ queryKey: ["push-notification-rules"] });
    toast.success(is_active ? "ההתראה הופעלה" : "ההתראה כובתה");
  }

  async function remove(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) return toast.error("מחיקה נכשלה: " + error.message);
    await qc.invalidateQueries({ queryKey: ["push-notification-rules"] });
    toast.success("ההתראה נמחקה");
  }

  async function sendInstantTest() {
    const TEST_ID = 19999998;
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform?.()) {
        toast.error("נכשל: התראות ניסיון נקלטות רק באפליקציה המותקנת בטלפון, לא בדפדפן");
        return;
      }
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") {
          toast.error("נכשל: ההרשאה להתראות חסומה בהגדרות הטלפון");
          return;
        }
      }
      await LocalNotifications.schedule({
        notifications: [{
          id: TEST_ID,
          title: "התראת ניסיון",
          body: "אם קיבלת הודעה זו — ההתראות בטלפון פועלות כשורה.",
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          smallIcon: "ic_stat_icon_config_sample",
        }],
      });
      const toastId = toast.loading("שולח התראת ניסיון… בודק קליטה בטלפון");
      let delivered = false;
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const list = await LocalNotifications.getDeliveredNotifications();
          if (list.notifications?.some((n: any) => n.id === TEST_ID)) { delivered = true; break; }
        } catch { /* ignore polling error */ }
      }
      if (delivered) {
        toast.success("ההתראה נקלטה בטלפון בהצלחה ✅", { id: toastId });
      } else {
        toast.error(
          "ההתראה נשלחה אך לא אותרה כנקלטה. בדוק בהגדרות הטלפון: הרשאת התראות, ביטול חיסכון סוללה והרשאת תזכורות מדויקות.",
          { id: toastId, duration: 8000 },
        );
      }
    } catch (e: any) {
      toast.error("שליחת התראת הניסיון נכשלה: " + (e?.message ?? "שגיאה לא ידועה"));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4" /> התראות לאפליקציה
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={sendInstantTest}>
              <BellRing className="w-4 h-4 ml-1" /> שלח התראת ניסיון
            </Button>
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="w-4 h-4 ml-1" /> התראה חדשה
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            התראות שנשלחות למכשיר הנייד (באפליקציה המותקנת). התזמון מתרענן בכל פתיחה של האפליקציה.
            אפשר להשתמש בתגיות <code className="text-xs">{"{count}"}</code>,{" "}
            <code className="text-xs">{"{total}"}</code>, <code className="text-xs">{"{date}"}</code>.
          </p>

          <NotificationDiagnostics />

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">טוען…</div>
          ) : rules.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">עדיין לא הוגדרו התראות.</div>
          ) : null}

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="text-right">פעיל</TableHead>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">ימים מראש</TableHead>
                  <TableHead className="text-right">שעה</TableHead>
                  <TableHead className="text-right">סכום מינימלי</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => {
                  const isOpen = openId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <TableRow>
                        <TableCell className="px-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpenId(isOpen ? null : r.id)}>
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Switch checked={r.is_active} onCheckedChange={(v) => toggle(r, v)} />
                        </TableCell>
                        <TableCell className="font-semibold">{r.name}</TableCell>
                        <TableCell className="text-sm">{triggerLabel(r.trigger_type)}</TableCell>
                        <TableCell className="text-sm">{r.trigger_type === "checks_due" ? r.days_before : "—"}</TableCell>
                        <TableCell className="text-sm">
                          {String(r.send_hour).padStart(2, "0")}:{String(r.send_minute).padStart(2, "0")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.min_amount != null ? r.min_amount.toLocaleString("he-IL") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="עריכה" onClick={() => setEditing(r)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <NotificationSimulator
                              asIcon
                              title={r.title_template}
                              body={r.body_template}
                              triggerType={r.trigger_type}
                              daysBefore={r.days_before}
                              sendHour={r.send_hour}
                              sendMinute={r.send_minute}
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="מחיקה" onClick={() => remove(r.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/20 p-4">
                            <div className="grid gap-2 sm:grid-cols-2 text-sm">
                              <div><b>כותרת:</b> {r.title_template || "—"}</div>
                              <div><b>קישור בלחיצה:</b> {r.link || "—"} {r.link_label ? `(${r.link_label})` : ""}</div>
                              <div className="sm:col-span-2"><b>תוכן:</b> {r.body_template || "—"}</div>
                              <div className="sm:col-span-2 text-muted-foreground text-xs">
                                {TRIGGERS.find((t) => t.value === r.trigger_type)?.hint}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "עריכת התראה" : "התראה חדשה"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>שם</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>סוג ההתראה</Label>
                  <Select value={editing.trigger_type} onValueChange={(v) => setEditing({ ...editing, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {editing.trigger_type === "checks_due" && (
                  <div className="space-y-1">
                    <Label>ימים לפני הפירעון</Label>
                    <Input type="number" min={0} max={30} value={editing.days_before ?? 1}
                      onChange={(e) => setEditing({ ...editing, days_before: Number(e.target.value) })} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label>שעת שליחה</Label>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={23} value={editing.send_hour ?? 7}
                      onChange={(e) => setEditing({ ...editing, send_hour: Number(e.target.value) })} />
                    <span>:</span>
                    <Input type="number" min={0} max={59} value={editing.send_minute ?? 0}
                      onChange={(e) => setEditing({ ...editing, send_minute: Number(e.target.value) })} />
                  </div>
                </div>
                {editing.trigger_type === "checks_due" && (
                  <div className="space-y-1">
                    <Label>סכום מינימלי (אופציונלי)</Label>
                    <Input type="number" value={editing.min_amount ?? ""}
                      onChange={(e) => setEditing({ ...editing, min_amount: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label>קישור בלחיצה</Label>
                  <Input value={editing.link ?? ""} onChange={(e) => setEditing({ ...editing, link: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>מילת הקישור בהתראה</Label>
                  <Input placeholder="לפירוט" value={editing.link_label ?? ""}
                    onChange={(e) => setEditing({ ...editing, link_label: e.target.value })} />
                  <p className="text-xs text-muted-foreground">המילה שתופיע ככפתור בתוך ההתראה בטלפון (למשל: לפירוט)</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>כותרת ההתראה</Label>
                  <Input value={editing.title_template ?? ""} onChange={(e) => setEditing({ ...editing, title_template: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>תוכן ההתראה</Label>
                  <Textarea rows={2} value={editing.body_template ?? ""} onChange={(e) => setEditing({ ...editing, body_template: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <span className="text-sm text-muted-foreground">{editing.is_active ?? true ? "פעיל" : "כבוי"}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {editing && (
              <NotificationSimulator
                title={editing.title_template ?? ""}
                body={editing.body_template ?? ""}
                triggerType={editing.trigger_type ?? "checks_due"}
                daysBefore={editing.days_before ?? 1}
                sendHour={editing.send_hour ?? 7}
                sendMinute={editing.send_minute ?? 0}
              />
            )}
            <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
            <Button onClick={saveEditing}>שמירה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
