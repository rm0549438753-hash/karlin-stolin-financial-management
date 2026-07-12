import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PlayCircle, ExternalLink, CheckCircle2, XCircle, ChevronDown, ChevronLeft, Trash2, RefreshCw } from "lucide-react";
import { triggerBackupNow, continueBackupNow, listBackupRuns, deleteBackupRun } from "@/lib/backup.functions";

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("he-IL");
}
function fmtSize(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const TABLE_LABELS: Record<string, string> = {
  transactions: "תנועות",
  accounts: "חשבונות",
  funds: "קופות",
  expense_types: "סוגי הוצאה",
  categories: "קטגוריות",
  subcategories: "תת־קטגוריות",
  action_history: "היסטוריית פעילות",
  sync_ignores: "חריגות סנכרון",
  profiles: "משתמשים",
  user_roles: "הרשאות",
  import_batches: "ייבואים",
};

export function BackupPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listBackupRuns);
  const trigger = useServerFn(triggerBackupNow);
  const continueRun = useServerFn(continueBackupNow);
  const del = useServerFn(deleteBackupRun);
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["backup_runs"],
    queryFn: () => list(),
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined;
      return running || data?.some((r) => r.status === "running") ? 3000 : false;
    },
  });

  const hasRunning = runs?.some((r: any) => r.status === "running");

  const runNow = useMutation({
    mutationFn: async () => {
      setRunning(true);
      return await trigger();
    },
    onSuccess: (res: any) => {
      if (res?.ok) {
        if (res.status === "success") toast.success(`גיבוי הושלם: ${res.fileName}`);
        else toast.success("הגיבוי התחיל וימשיך אוטומטית ברקע");
      } else {
        toast.error(`שגיאה בגיבוי: ${res?.error ?? "לא ידוע"}`);
      }
      qc.invalidateQueries({ queryKey: ["backup_runs"] });
    },
    onError: (err: any) => toast.error(`שגיאה בגיבוי: ${err?.message ?? err}`),
    onSettled: () => setRunning(false),
  });

  const deleteRun = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("נמחק");
      qc.invalidateQueries({ queryKey: ["backup_runs"] });
    },
    onError: (err: any) => toast.error(`שגיאה: ${err?.message ?? err}`),
  });

  useEffect(() => {
    if (!hasRunning || advance.isPending || runNow.isPending) return;
    const timer = window.setTimeout(() => advance.mutate(), 2500);
    return () => window.clearTimeout(timer);
  }, [hasRunning, advance.isPending, runNow.isPending]);

  const lastSuccess = runs?.find((r: any) => r.status === "success");
  const rootFolderId = runs?.find((r: any) => r.folder_id)?.folder_id ?? lastSuccess?.folder_id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>גיבוי יומי לגוגל דרייב</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            כל יום ב-02:00 (שעון ישראל) המערכת מייצאת את כל הטבלאות כקובצי CSV
            (מפוצלים לחלקים כדי להישאר בגבולות הזיכרון) ומעלה לתיקייה{" "}
            <b>"גיבויים - מרכז קארלין סטולין"</b> בגוגל דרייב. שומרים גיבויים של
            30 הימים האחרונים.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runNow.mutate()} disabled={runNow.isPending || running || hasRunning}>
              {runNow.isPending || running ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> מריץ גיבוי...</>
              ) : (
                <><PlayCircle className="ml-2 h-4 w-4" /> הפעל גיבוי עכשיו</>
              )}
            </Button>
            {rootFolderId && (
              <Button variant="outline" asChild>
                <a
                  href={`https://drive.google.com/drive/folders/${rootFolderId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="ml-2 h-4 w-4" /> פתח תיקיית גיבויים ראשית
                </a>
              </Button>
            )}
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
            <div className="text-sm text-muted-foreground">עוד לא רצה שום גיבוי.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>התחלה</TableHead>
                    <TableHead>סיום</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>התקדמות</TableHead>
                    <TableHead>גודל</TableHead>
                    <TableHead>תיקייה</TableHead>
                    <TableHead>פרטי שגיאה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        {r.status === "success" ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                            <CheckCircle2 className="h-4 w-4" /> הושלם בהצלחה
                          </span>
                        ) : r.status === "failed" ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <XCircle className="h-4 w-4" /> נכשל
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                            <Loader2 className="h-4 w-4 animate-spin" /> רץ...
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.started_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.finished_at)}</TableCell>
                      <TableCell>{r.triggered_by === "cron" ? "אוטומטי" : "ידני"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.status === "running"
                          ? `${TABLE_LABELS[r.current_table] ?? r.current_table ?? "מתחיל"} · ${Number(r.processed_rows ?? 0).toLocaleString("he-IL")} רשומות`
                          : r.status === "success"
                            ? `${Number(r.processed_rows ?? 0).toLocaleString("he-IL")} רשומות`
                            : "—"}
                      </TableCell>
                      <TableCell>{fmtSize(r.size_bytes)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.file_id ? (
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={`https://drive.google.com/drive/folders/${r.file_id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="ml-1 h-3 w-3" /> פתח תיקייה
                            </a>
                          </Button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[360px]">
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
