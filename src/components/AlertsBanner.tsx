import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CalendarClock, CalendarX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";
import { useAccounts } from "@/hooks/use-lookups";
import { useTransactionsRealtime } from "@/hooks/use-tx-realtime";
import { formatCurrency, formatDate } from "@/lib/format";

export function AlertsBanner() {
  const { data: accounts = [] } = useAccounts();
  const checksAccount = accounts.find((a: any) => a.schema_type === "checks");
  const qc = useQueryClient();

  // Keep the banner counts in step with the transaction screens: any insert,
  // edit, import or delete refreshes them (debounced for bulk operations).
  useTransactionsRealtime("alerts-banner-tx", () => {
    qc.invalidateQueries({ queryKey: ["alerts-upcoming-checks"] });
    qc.invalidateQueries({ queryKey: ["alerts-uncategorized-count"] });
    qc.invalidateQueries({ queryKey: ["alerts-no-date-count"] });
  });

  const CACHE = { staleTime: 5 * 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false } as const;

  const { data: upcomingChecks = [] } = useQuery({
    queryKey: ["alerts-upcoming-checks", checksAccount?.id],
    enabled: !!checksAccount,
    queryFn: async () => {
      if (!(await hasLiveSession())) return [];
      const today = new Date().toISOString().slice(0, 10);
      const wk = new Date(); wk.setDate(wk.getDate() + 7);
      const weekAhead = wk.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("transactions")
        .select("id, value_date, amount, description, payee")
        .eq("account_id", checksAccount!.id)
        .gte("value_date", today)
        .lte("value_date", weekAhead);
      if (error) throw error;
      return data ?? [];
    },
    ...CACHE,
  });

  const { data: uncategorizedCount = 0 } = useQuery({
    queryKey: ["alerts-uncategorized-count"],
    queryFn: async () => {
      if (!(await hasLiveSession())) return 0;
      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .is("fund_id", null)
        .is("expense_type_id", null);
      if (error) throw error;
      return count ?? 0;
    },
    ...CACHE,
  });

  const checksAccountId = checksAccount?.id;
  const { data: noDateCount = 0 } = useQuery({
    queryKey: ["alerts-no-date-count", checksAccountId ?? "none"],
    queryFn: async () => {
      if (!(await hasLiveSession())) return 0;
      // Checks account is dateless only when value_date is missing.
      // Other accounts are dateless when both transaction_date and value_date are missing.
      let others = supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .is("transaction_date", null)
        .is("value_date", null);
      if (checksAccountId) others = others.neq("account_id", checksAccountId);
      const { count: othersCount, error: e1 } = await others;
      if (e1) throw e1;

      let checksCount = 0;
      if (checksAccountId) {
        const { count, error: e2 } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("account_id", checksAccountId)
          .is("value_date", null);
        if (e2) throw e2;
        checksCount = count ?? 0;
      }
      return (othersCount ?? 0) + checksCount;
    },
    ...CACHE,
  });


  const totalChecks = upcomingChecks.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

  if (upcomingChecks.length === 0 && uncategorizedCount === 0 && noDateCount === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {upcomingChecks.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-semibold">
              {upcomingChecks.length} צ׳קים יוצאים השבוע · {formatCurrency(totalChecks)}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              הקרוב: {formatDate((upcomingChecks[0] as any).value_date)} — {(upcomingChecks[0] as any).description ?? (upcomingChecks[0] as any).payee ?? ""}
            </div>
          </div>
          <Link to="/reports" className="text-xs font-semibold underline">לדוח</Link>
        </div>
      )}
      {uncategorizedCount > 0 && (
        <div className="rounded-lg border border-orange-400/50 bg-orange-100/50 dark:bg-orange-950/30 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-semibold">{uncategorizedCount} תנועות לא מסווגות</div>
            <div className="text-xs text-muted-foreground">דורש סיווג של סוג או קופה</div>
          </div>
          <Link
            to="/reports"
            search={{ tab: "uncategorized" } as any}
            className="text-xs font-semibold rounded-md bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 shrink-0"
          >
            לחץ כאן לסיווג
          </Link>
        </div>
      )}
      {noDateCount > 0 && (
        <div className="rounded-lg border border-rose-400/50 bg-rose-100/50 dark:bg-rose-950/30 px-4 py-3 flex items-center gap-3">
          <CalendarX className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-semibold">{noDateCount} תנועות ללא תאריך</div>
            <div className="text-xs text-muted-foreground">לא נכללות בחישובי הגרפים והעוגות</div>
          </div>
          <Link
            to="/reports"
            search={{ tab: "no-date" } as any}
            className="text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 shrink-0"
          >
            לעדכון תאריך
          </Link>
        </div>
      )}
    </div>
  );
}

