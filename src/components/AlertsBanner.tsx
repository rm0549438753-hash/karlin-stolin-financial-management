import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts } from "@/hooks/use-lookups";
import { formatCurrency, formatDate } from "@/lib/format";

export function AlertsBanner() {
  const { data: accounts = [] } = useAccounts();
  const checksAccount = accounts.find((a: any) => a.schema_type === "checks");

  const { data: upcomingChecks = [] } = useQuery({
    queryKey: ["alerts-upcoming-checks", checksAccount?.id],
    enabled: !!checksAccount,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const wk = new Date(); wk.setDate(wk.getDate() + 7);
      const weekAhead = wk.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("transactions")
        .select("id, value_date, amount, description")
        .eq("account_id", checksAccount!.id)
        .gte("value_date", today)
        .lte("value_date", weekAhead);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: uncategorizedCount = 0 } = useQuery({
    queryKey: ["alerts-uncategorized-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .is("fund_id", null)
        .is("expense_type_id", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const totalChecks = upcomingChecks.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

  if (upcomingChecks.length === 0 && uncategorizedCount === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {upcomingChecks.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <div className="font-semibold">
              {upcomingChecks.length} צ׳קים יוצאים השבוע · {formatCurrency(totalChecks)}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              הקרוב: {formatDate((upcomingChecks[0] as any).value_date)} — {(upcomingChecks[0] as any).description ?? ""}
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
    </div>
  );
}
