import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";

/**
 * Phone reminders for upcoming checks (native app only).
 *
 * The due dates are known in advance, so the app schedules *local* notifications
 * on the device: one per due date, fired at 07:00 the day before payment.
 * No Google/Firebase, no server push — the phone raises them by itself even
 * offline. Re-scheduled on every app open so new/edited checks are picked up.
 */

const HOUR = 7; // 07:00 local time, the day before the due date

function toKey(iso: string): number {
  // Stable numeric id per due date (yyyymmdd) so re-scheduling replaces, not duplicates.
  return Number(iso.replace(/-/g, ""));
}

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

export function useCheckNotifications() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform?.()) return; // browser: nothing to schedule
        if (!(await hasLiveSession())) return;

        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") {
          const req = await LocalNotifications.requestPermissions();
          if (req.display !== "granted") return;
        }
        if (cancelled) return;

        // Only future-dated checks matter.
        const today = new Date().toISOString().slice(0, 10);
        const { data: accounts } = await supabase.from("accounts").select("id,schema_type");
        const checksAcc = (accounts ?? []).find((a: any) => a.schema_type === "checks");
        if (!checksAcc) return;

        const { data: rows } = await supabase
          .from("transactions")
          .select("value_date,amount")
          .eq("account_id", checksAcc.id)
          .gt("value_date", today)
          .order("value_date")
          .limit(1000);
        if (cancelled || !rows?.length) return;

        // Group by due date.
        const byDate = new Map<string, { count: number; total: number }>();
        for (const r of rows as any[]) {
          if (!r.value_date) continue;
          const e = byDate.get(r.value_date) ?? { count: 0, total: 0 };
          e.count += 1;
          e.total += Math.abs(Number(r.amount) || 0);
          byDate.set(r.value_date, e);
        }

        const now = Date.now();
        const list = [...byDate.entries()]
          .map(([date, e]) => {
            const [y, m, d] = date.split("-").map(Number);
            const at = new Date(y, m - 1, d - 1, HOUR, 0, 0, 0); // day before, 07:00 local
            return { date, e, at };
          })
          .filter((x) => x.at.getTime() > now)
          .slice(0, 60); // Android caps pending alarms; nearest dates are enough
        if (!list.length) return;

        // Clear previously scheduled check reminders so edits don't pile up.
        const pending = await LocalNotifications.getPending();
        const ours = pending.notifications.filter((n) => n.id > 20000000);
        if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });

        await LocalNotifications.schedule({
          notifications: list.map(({ date, e, at }) => ({
            id: toKey(date),
            title: `מחר: ${e.count} צ'קים לפירעון`,
            body: `סה"כ ${fmtAmount(e.total)}. מומלץ לוודא כיסוי בחשבון.`,
            schedule: { at, allowWhileIdle: true },
            smallIcon: "ic_stat_icon_config_sample",
            extra: { link: "/reports?tab=future-checks", date },
          })),
        });
      } catch {
        /* notifications are a convenience — never break the app over them */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
