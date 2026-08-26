import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";

/**
 * Phone reminders (native app only).
 *
 * The rules are defined by an admin in "הגדרות ניהול → התראות לאפליקציה"
 * (table push_notification_rules) and are scheduled as *local* notifications
 * on the device — no Google/Firebase, no server push. Re-scheduled on every
 * app open so new/edited checks and rules are picked up.
 */

export type PushRule = {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: "checks_due" | "uncategorized" | "no_date" | string;
  days_before: number;
  send_hour: number;
  send_minute: number;
  min_amount: number | null;
  title_template: string;
  body_template: string;
  link: string;
  link_label?: string | null;
};

function fmtAmount(n: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// Stable numeric id per rule+date so re-scheduling replaces instead of duplicating.
function notifId(ruleIndex: number, dateKey: string): number {
  return 20000000 + ruleIndex * 100000 + (Number(dateKey.slice(4)) || 0);
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

        const { data: rulesRaw } = await supabase
          .from("push_notification_rules" as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order");
        const rules = (rulesRaw ?? []) as unknown as PushRule[];
        if (cancelled || !rules.length) return;

        const now = Date.now();
        const today = new Date().toISOString().slice(0, 10);
        const planned: Array<{ id: number; title: string; body: string; at: Date; link: string; label: string; ruleIndex: number }> = [];

        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i]!;

          if (rule.trigger_type === "checks_due") {
            const { data: accounts } = await supabase.from("accounts").select("id,schema_type");
            const checksAcc = (accounts ?? []).find((a: any) => a.schema_type === "checks");
            if (!checksAcc) continue;

            const { data: rows } = await supabase
              .from("transactions")
              .select("value_date,amount")
              .eq("account_id", checksAcc.id)
              .gt("value_date", today)
              .order("value_date")
              .limit(1000);
            if (!rows?.length) continue;

            const byDate = new Map<string, { count: number; total: number }>();
            for (const r of rows as any[]) {
              if (!r.value_date) continue;
              const e = byDate.get(r.value_date) ?? { count: 0, total: 0 };
              e.count += 1;
              e.total += Math.abs(Number(r.amount) || 0);
              byDate.set(r.value_date, e);
            }

            for (const [date, e] of byDate) {
              if (rule.min_amount != null && e.total < Number(rule.min_amount)) continue;
              const [y, m, d] = date.split("-").map(Number);
              const at = new Date(y!, m! - 1, d! - (rule.days_before ?? 1), rule.send_hour, rule.send_minute, 0, 0);
              if (at.getTime() <= now) continue;
              planned.push({
                id: notifId(i, date.replace(/-/g, "")),
                title: renderTemplate(rule.title_template, { count: e.count, total: fmtAmount(e.total), date: fmtDate(date) }),
                body: renderTemplate(rule.body_template, { count: e.count, total: fmtAmount(e.total), date: fmtDate(date) }),
                at,
                link: rule.link,
              });
            }
          } else if (rule.trigger_type === "uncategorized" || rule.trigger_type === "no_date") {
            const { data: counts } = await supabase.rpc("tx_alert_counts");
            const c = counts as any;
            const count = rule.trigger_type === "uncategorized" ? Number(c?.uncategorized_total ?? 0) : Number(c?.no_date ?? 0);
            if (!count) continue;
            const at = new Date();
            at.setHours(rule.send_hour, rule.send_minute, 0, 0);
            if (at.getTime() <= now) at.setDate(at.getDate() + 1);
            const key = at.toISOString().slice(0, 10).replace(/-/g, "");
            planned.push({
              id: notifId(i, key),
              title: renderTemplate(rule.title_template, { count, total: "", date: fmtDate(at.toISOString().slice(0, 10)) }),
              body: renderTemplate(rule.body_template, { count, total: "", date: fmtDate(at.toISOString().slice(0, 10)) }),
              at,
              link: rule.link,
            });
          }
        }

        if (cancelled) return;

        // Clear previously scheduled reminders so edits don't pile up.
        const pending = await LocalNotifications.getPending();
        const ours = pending.notifications.filter((n) => n.id >= 20000000);
        if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });

        const list = planned.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
        if (!list.length) return;

        await LocalNotifications.schedule({
          notifications: list.map(({ id, title, body, at, link }) => ({
            id,
            title,
            body,
            schedule: { at, allowWhileIdle: true },
            smallIcon: "ic_stat_icon_config_sample",
            extra: { link },
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
