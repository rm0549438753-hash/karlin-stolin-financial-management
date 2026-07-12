import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Mail, CheckCircle2, XCircle, CircleSlash } from "lucide-react";
import { triggerChecksEmailNow, listChecksEmailRuns } from "@/lib/checks-email.functions";

const RECIPIENTS = ["RM0549438753@gmail.com", "5326725@gmail.com"];
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

export function UpcomingChecksEmailPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listChecksEmailRuns);
  const trigger = useServerFn(triggerChecksEmailNow);
  const [running, setRunning] = useState(false);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["check_email_runs"],
    queryFn: () => list(),
    refetchInterval: running ? 3000 : false,
  });

  const runNow = useMutation({
    mutationFn: async () => {
      setRunning(true);
      return await trigger();
    },
    onSuccess: (res: any) => {
      if (res?.ok && res?.sent) {
        toast.success(`המייל נשלח · ${res.count} צ'קים`);
      } else if (res?.ok && res?.skipped) {
        toast.info("אין צ'קים למחר — לא נשלח מייל");
      } else {
        toast.error(`שגיאה: ${res?.error ?? "לא ידוע"}`);
      }
      qc.invalidateQueries({ queryKey: ["check_email_runs"] });
    },
    onError: (err: any) => toast.error(`שגיאה: ${err?.message ?? err}`),
    onSettled: () => setRunning(false),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>מייל יומי · צ'קים שיוצאים מחר</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            כל יום ב-10:00 (שעון ישראל) המערכת בודקת אילו צ'קים אמורים לצאת מהבנק
            למחרת (לפי <b>תאריך ערך</b>), ושולחת מייל מפורט לנמענים. אם אין צ'קים
            למחר — לא נשלח כלום.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">שולח מהחשבון</div>
              <div className="font-mono" dir="ltr">{SENDER}</div>
            </div>
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">נמענים</div>
              <div className="font-mono text-xs leading-relaxed" dir="ltr">
                {RECIPIENTS.map((r) => (
                  <div key={r}>{r}</div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Button onClick={() => runNow.mutate()} disabled={runNow.isPending || running}>
              {runNow.isPending || running ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> שולח...</>
              ) : (
                <><Mail className="ml-2 h-4 w-4" /> שלח עכשיו לבדיקה</>
              )}
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
                    <TableHead>סטטוס</TableHead>
                    <TableHead>תאריך ריצה</TableHead>
                    <TableHead>עבור תאריך</TableHead>
                    <TableHead>צ'קים</TableHead>
                    <TableHead>סה"כ</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>שגיאה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(runs as any[]).map((r) => (
                    <TableRow key={r.id}>
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
                      <TableCell className="max-w-[320px]">
                        {r.error_message ? (
                          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                            {r.error_message}
                          </div>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
