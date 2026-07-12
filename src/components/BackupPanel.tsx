import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PlayCircle, ExternalLink } from "lucide-react";
import { triggerBackupNow, listBackupRuns } from "@/lib/backup.functions";

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

export function BackupPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listBackupRuns);
  const trigger = useServerFn(triggerBackupNow);
  const [running, setRunning] = useState(false);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["backup_runs"],
    queryFn: () => list(),
    refetchInterval: running ? 3000 : false,
  });

  const runNow = useMutation({
    mutationFn: async () => {
      setRunning(true);
      return await trigger();
    },
    onSuccess: (res: any) => {
      toast.success(`גיבוי הושלם: ${res.fileName}`);
      qc.invalidateQueries({ queryKey: ["backup_runs"] });
    },
    onError: (err: any) => toast.error(`שגיאה בגיבוי: ${err?.message ?? err}`),
    onSettled: () => setRunning(false),
  });

  const lastSuccess = runs?.find((r: any) => r.status === "success");
  const folderId = lastSuccess?.folder_id ?? runs?.find((r: any) => r.folder_id)?.folder_id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>גיבוי יומי לגוגל דרייב</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            כל יום ב-02:00 (שעון ישראל) המערכת יוצרת קובץ Excel עם כל הנתונים
            (תנועות, חשבונות, קופות, קטגוריות, היסטוריית פעילות ועוד) ומעלה אותו
            לתיקייה <b>"גיבויים - מרכז קארלין סטולין"</b> בגוגל דרייב. שומרים גיבויים
            של 30 הימים האחרונים.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runNow.mutate()} disabled={runNow.isPending || running}>
              {runNow.isPending || running ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> מריץ גיבוי...</>
              ) : (
                <><PlayCircle className="ml-2 h-4 w-4" /> הפעל גיבוי עכשיו</>
              )}
            </Button>
            {folderId && (
              <Button variant="outline" asChild>
                <a
                  href={`https://drive.google.com/drive/folders/${folderId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="ml-2 h-4 w-4" /> פתח תיקייה בדרייב
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
                    <TableHead>התחלה</TableHead>
                    <TableHead>סיום</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>קובץ</TableHead>
                    <TableHead>גודל</TableHead>
                    <TableHead>שגיאה</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.started_at)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.finished_at)}</TableCell>
                      <TableCell>
                        <span className={
                          r.status === "success" ? "text-green-600" :
                          r.status === "failed" ? "text-red-600" : "text-amber-600"
                        }>
                          {r.status === "success" ? "הצלחה" : r.status === "failed" ? "כשל" : "רץ"}
                        </span>
                      </TableCell>
                      <TableCell>{r.triggered_by === "cron" ? "אוטומטי" : "ידני"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.file_id ? (
                          <a
                            className="text-primary underline"
                            href={`https://drive.google.com/file/d/${r.file_id}/view`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {r.file_name}
                          </a>
                        ) : (r.file_name ?? "—")}
                      </TableCell>
                      <TableCell>{fmtSize(r.size_bytes)}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-red-600" title={r.error_message ?? undefined}>
                        {r.error_message ?? "—"}
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
