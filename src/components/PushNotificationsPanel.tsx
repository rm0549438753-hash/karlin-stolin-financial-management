import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Save, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  sort_order: number;
};

export function PushNotificationsPanel() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Partial<Rule>>>({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["push-notification-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABLE).select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Rule[];
    },
  });

  function patch(id: string, values: Partial<Rule>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...values } }));
  }

  async function save(rule: Rule) {
    const changes = drafts[rule.id];
    if (!changes) return;
    const { error } = await supabase.from(TABLE).update(changes as any).eq("id", rule.id);
    if (error) return toast.error("שמירה נכשלה: " + error.message);
    setDrafts((d) => { const n = { ...d }; delete n[rule.id]; return n; });
    await qc.invalidateQueries({ queryKey: ["push-notification-rules"] });
    toast.success("ההתראה נשמרה");
  }

  async function toggle(rule: Rule, is_active: boolean) {
    const { error } = await supabase.from(TABLE).update({ is_active } as any).eq("id", rule.id);
    if (error) return toast.error("עדכון נכשל: " + error.message);
    await qc.invalidateQueries({ queryKey: ["push-notification-rules"] });
    toast.success(is_active ? "ההתראה הופעלה" : "ההתראה כובתה");
  }

  async function addRule() {
    const { error } = await supabase.from(TABLE).insert({
      name: "התראה חדשה",
      trigger_type: "checks_due",
      days_before: 1,
      send_hour: 7,
      send_minute: 0,
      title_template: "{count} צ׳קים לפירעון ב-{date}",
      body_template: 'סה"כ {total}. מומלץ לוודא כיסוי בחשבון.',
      link: "/reports?tab=future-checks",
      sort_order: rules.length,
    } as any);
    if (error) return toast.error("הוספה נכשלה: " + error.message);
    await qc.invalidateQueries({ queryKey: ["push-notification-rules"] });
    toast.success("נוספה התראה חדשה");
  }

  async function remove(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) return toast.error("מחיקה נכשלה: " + error.message);
    await qc.invalidateQueries({ queryKey: ["push-notification-rules"] });
    toast.success("ההתראה נמחקה");
  }

  async function sendTest() {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform?.()) {
        toast.info("בדיקת התראה אפשרית רק באפליקציה המותקנת בטלפון");
        return;
      }
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") {
          toast.error("ההרשאה להתראות חסומה בהגדרות הטלפון");
          return;
        }
      }
      await LocalNotifications.schedule({
        notifications: [{
          id: 19999999,
          title: "בדיקת התראה",
          body: "אם קיבלת הודעה זו — ההתראות בטלפון פועלות כשורה.",
          schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
          smallIcon: "ic_stat_icon_config_sample",
        }],
      });
      toast.success("התראת בדיקה תופיע בעוד כ-5 שניות");
    } catch {
      toast.error("שליחת התראת הבדיקה נכשלה");
    }
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> התראות לאפליקציה</CardTitle>
          <CardDescription>
            התראות שנשלחות למכשיר הנייד (באפליקציה המותקנת). התזמון מתרענן בכל פתיחה של האפליקציה.
            ניתן להשתמש בתגיות בנוסח: <code>{"{count}"}</code> · <code>{"{total}"}</code> · <code>{"{date}"}</code>
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={sendInstantTest}><BellRing className="w-4 h-4 ml-1" /> שלח התראת ניסיון</Button>
          <Button variant="outline" size="sm" onClick={sendTest}><BellRing className="w-4 h-4 ml-1" /> בדיקת התראה</Button>
          <Button size="sm" onClick={addRule}><Plus className="w-4 h-4 ml-1" /> התראה חדשה</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <NotificationDiagnostics />
        {isLoading && <div className="text-sm text-muted-foreground">טוען…</div>}
        {!isLoading && rules.length === 0 && (
          <div className="text-sm text-muted-foreground">אין עדיין התראות מוגדרות.</div>
        )}
        {rules.map((rule) => {
          const d = { ...rule, ...drafts[rule.id] } as Rule;
          const dirty = !!drafts[rule.id];
          const trigger = TRIGGERS.find((t) => t.value === d.trigger_type);
          return (
            <div key={rule.id} className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Input
                  value={d.name}
                  onChange={(e) => patch(rule.id, { name: e.target.value })}
                  className="max-w-xs font-semibold"
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={d.is_active} onCheckedChange={(v) => toggle(rule, v)} />
                    <span className="text-xs text-muted-foreground">{d.is_active ? "פעיל" : "כבוי"}</span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>למחוק את ההתראה?</AlertDialogTitle>
                        <AlertDialogDescription>הפעולה תבטל את שליחת ההתראה הזו לטלפונים.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(rule.id)}>מחיקה</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">סוג ההתראה</Label>
                  <Select value={d.trigger_type} onValueChange={(v) => patch(rule.id, { trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {trigger && <p className="text-[11px] text-muted-foreground">{trigger.hint}</p>}
                </div>
                {d.trigger_type === "checks_due" && (
                  <div className="space-y-1">
                    <Label className="text-xs">ימים לפני הפירעון</Label>
                    <Input type="number" min={0} max={30} value={d.days_before}
                      onChange={(e) => patch(rule.id, { days_before: Number(e.target.value) })} />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">שעת שליחה</Label>
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={23} value={d.send_hour}
                      onChange={(e) => patch(rule.id, { send_hour: Number(e.target.value) })} />
                    <span>:</span>
                    <Input type="number" min={0} max={59} value={d.send_minute}
                      onChange={(e) => patch(rule.id, { send_minute: Number(e.target.value) })} />
                  </div>
                </div>
                {d.trigger_type === "checks_due" && (
                  <div className="space-y-1">
                    <Label className="text-xs">סכום מינימלי (אופציונלי)</Label>
                    <Input type="number" value={d.min_amount ?? ""}
                      onChange={(e) => patch(rule.id, { min_amount: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">כותרת ההתראה</Label>
                  <Input value={d.title_template} onChange={(e) => patch(rule.id, { title_template: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">קישור בלחיצה</Label>
                  <Input value={d.link} onChange={(e) => patch(rule.id, { link: e.target.value })} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">תוכן ההתראה</Label>
                  <Textarea rows={2} value={d.body_template} onChange={(e) => patch(rule.id, { body_template: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <NotificationSimulator
                  title={d.title_template}
                  body={d.body_template}
                  triggerType={d.trigger_type}
                  daysBefore={d.days_before}
                  sendHour={d.send_hour}
                  sendMinute={d.send_minute}
                />
                <Button size="sm" disabled={!dirty} onClick={() => save(rule)}>
                  <Save className="w-4 h-4 ml-1" /> שמירה
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
