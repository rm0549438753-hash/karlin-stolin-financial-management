import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = {
  native: boolean;
  platform: string;
  permission: "granted" | "denied" | "prompt" | "unknown";
  exactAlarms: "granted" | "denied" | "unknown" | "n/a";
  appActive: boolean;
  pending: number | null;
};

const EMPTY: Status = {
  native: false,
  platform: "web",
  permission: "unknown",
  exactAlarms: "unknown",
  appActive: true,
  pending: null,
};

export function NotificationDiagnostics() {
  const [status, setStatus] = useState<Status>(EMPTY);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const { Capacitor } = await import("@capacitor/core");
      const native = !!Capacitor.isNativePlatform?.();
      const platform = Capacitor.getPlatform?.() ?? "web";
      if (!native) {
        setStatus({ ...EMPTY, native: false, platform, appActive: document.visibilityState === "visible" });
        return;
      }
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      let permission: Status["permission"] = "unknown";
      try {
        const p = await LocalNotifications.checkPermissions();
        permission = (p.display as Status["permission"]) ?? "unknown";
      } catch { /* ignore */ }

      let exactAlarms: Status["exactAlarms"] = platform === "android" ? "unknown" : "n/a";
      try {
        const anyLN = LocalNotifications as any;
        if (platform === "android" && typeof anyLN.checkExactNotificationSetting === "function") {
          const e = await anyLN.checkExactNotificationSetting();
          exactAlarms = e?.exact_alarm === "granted" ? "granted" : "denied";
        }
      } catch { /* ignore */ }

      let pending: number | null = null;
      try {
        const list = await LocalNotifications.getPending();
        pending = list.notifications?.length ?? 0;
      } catch { /* ignore */ }

      let appActive = document.visibilityState === "visible";
      try {
        const { App } = await import("@capacitor/app");
        const state = await App.getState();
        appActive = !!state.isActive;
      } catch { /* ignore */ }

      setStatus({ native, platform, permission, exactAlarms, appActive, pending });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const onVis = () => check();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [check]);

  async function openExactAlarmSettings() {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const anyLN = LocalNotifications as any;
      if (typeof anyLN.changeExactNotificationSetting === "function") {
        await anyLN.changeExactNotificationSetting();
        setTimeout(check, 1500);
      }
    } catch { /* ignore */ }
  }

  async function requestPermission() {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.requestPermissions();
      check();
    } catch { /* ignore */ }
  }

  const problems: { title: string; fix: string; action?: () => void; actionLabel?: string }[] = [];

  if (!status.native) {
    problems.push({
      title: "אתה צופה כרגע בדפדפן, לא באפליקציה",
      fix: "התראות לנייד נשלחות רק מהאפליקציה המותקנת בטלפון. פתח את המערכת דרך האפליקציה כדי לבדוק התראות.",
    });
  } else {
    if (status.permission !== "granted") {
      problems.push({
        title: "ההרשאה להתראות אינה מאושרת",
        fix: "אשר את הרשאת ההתראות. אם ההרשאה נחסמה: הגדרות הטלפון ← אפליקציות ← קרלין סטולין ← התראות ← הפעל.",
        action: requestPermission,
        actionLabel: "בקש הרשאה",
      });
    }
    if (status.exactAlarms === "denied") {
      problems.push({
        title: "תזכורות מדויקות חסומות",
        fix: "בלי הרשאה זו ההתראה עלולה להתעכב בשעות. אשר 'התראות ותזכורות' / Alarms & reminders.",
        action: openExactAlarmSettings,
        actionLabel: "פתח הגדרה",
      });
    }
    if (status.pending === 0) {
      problems.push({
        title: "אין כרגע התראות מתוזמנות בטלפון",
        fix: "התזמון מתבצע בפתיחת האפליקציה. ודא שיש כללים פעילים ונתונים מתאימים (למשל צ׳ק שפירעונו מחר), ופתח מחדש את האפליקציה.",
      });
    }
    if (!status.appActive) {
      problems.push({
        title: "האפליקציה ברקע",
        fix: "התזמון והבדיקה מתבצעים כשהאפליקציה פתוחה בחזית. פתח את האפליקציה ונסה שוב.",
      });
    }
  }

  const ok = problems.length === 0;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 font-semibold">
          <Smartphone className="w-4 h-4" /> מצב ההתראות במכשיר
        </div>
        <Button variant="outline" size="sm" onClick={check} disabled={checking}>
          <RefreshCw className={`w-4 h-4 ml-1 ${checking ? "animate-spin" : ""}`} /> בדיקה מחדש
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Stat label="סביבה" value={status.native ? `אפליקציה (${status.platform})` : "דפדפן"} good={status.native} />
        <Stat
          label="הרשאת התראות"
          value={status.permission === "granted" ? "מאושרת" : status.permission === "denied" ? "חסומה" : "לא נקבעה"}
          good={status.permission === "granted"}
        />
        <Stat
          label="תזכורות מדויקות"
          value={status.exactAlarms === "granted" ? "מאושרות" : status.exactAlarms === "denied" ? "חסומות" : "לא ידוע"}
          good={status.exactAlarms === "granted"}
        />
        <Stat
          label="התראות מתוזמנות"
          value={status.pending === null ? "—" : String(status.pending)}
          good={!!status.pending}
        />
      </div>

      {ok ? (
        <div className="flex items-start gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 mt-0.5" /> הכול תקין — ההתראות אמורות להגיע בזמן.
        </div>
      ) : (
        <div className="space-y-2">
          {problems.map((p, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              {i === 0 ? <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-500" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500" />}
              <div className="space-y-1 flex-1">
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.fix}</div>
                {p.action && (
                  <Button variant="outline" size="sm" className="mt-1" onClick={p.action}>{p.actionLabel}</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-medium ${good ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{value}</div>
    </div>
  );
}
