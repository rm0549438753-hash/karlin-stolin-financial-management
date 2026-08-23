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
      qc.invalidateQueries({ queryKey: ["backup_runs"], refetchType: "active" });
    },
    onError: (err: any) => toast.error(`שגיאה בגיבוי: ${err?.message ?? err}`),
    onSettled: () => setRunning(false),
  });

  const advance = useMutation({
    mutationFn: () => continueRun(),
    onSettled: () => qc.invalidateQueries({ queryKey: ["backup_runs"], refetchType: "active" }),
  });

  const deleteRun = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("נמחק");
      qc.invalidateQueries({ queryKey: ["backup_runs"], refetchType: "active" });
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
            כל יום ב-02:00 (שעון ישראל) המערכת מייצאת את כל התנועות לקובץ Excel אחד
            (גיליון נפרד לכל חשבון + גיליונות הגדרות) ומעלה לתיקייה{" "}
            <b>"גיבויים - מרכז קארלין סטולין"</b> בגוגל דרייב. כל הרצה מוחקת את
            הקבצים הקודמים בתיקייה ומעלה קובץ אחד חדש.
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
                    <TableHead className="w-8"></TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>התחלה</TableHead>
                    <TableHead>סיום</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>התקדמות</TableHead>
                    <TableHead>גודל</TableHead>
                    <TableHead>תיקייה</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r: any) => {
                    const isOpen = openId === r.id;
                    return (
                      <>
                        <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(isOpen ? null : r.id)}>
                          <TableCell>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.status === "success" ? (
                              <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                                <CheckCircle2 className="h-4 w-4" /> הושלם
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
                              <a
                                href={`https://drive.google.com/file/d/${r.file_id}/view`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                              >
                                <ExternalLink className="h-3 w-3" /> פתח קובץ
                              </a>
                            ) : "—"}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                title="הרץ גיבוי חדש"
                                onClick={() => runNow.mutate()}
                                disabled={runNow.isPending || hasRunning}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="מחק"
                                onClick={() => { if (confirm("למחוק את השורה?")) deleteRun.mutate(r.id); }}
                                disabled={deleteRun.isPending || r.status === "running"}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow key={r.id + "-detail"} className="bg-muted/40">
                            <TableCell colSpan={9}>
                              <div className="p-3 space-y-3 text-sm">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div><div className="text-xs text-muted-foreground">ID</div><div className="font-mono text-xs" dir="ltr">{r.id}</div></div>
                                  <div><div className="text-xs text-muted-foreground">שם קובץ</div><div className="truncate">{r.file_name ?? "—"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">Folder ID</div><div className="font-mono text-xs" dir="ltr">{r.folder_id ?? "—"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">Heartbeat</div><div>{fmtDate(r.heartbeat_at)}</div></div>
                                  <div><div className="text-xs text-muted-foreground">טבלה נוכחית</div><div>{TABLE_LABELS[r.current_table] ?? r.current_table ?? "—"}</div></div>
                                  <div><div className="text-xs text-muted-foreground">שורות שעובדו</div><div>{Number(r.processed_rows ?? 0).toLocaleString("he-IL")}</div></div>
                                  <div><div className="text-xs text-muted-foreground">גודל</div><div>{fmtSize(r.size_bytes)}</div></div>
                                  <div><div className="text-xs text-muted-foreground">מקור</div><div>{r.triggered_by === "cron" ? "אוטומטי" : "ידני"}</div></div>
                                </div>
                                {r.row_counts && (
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">כמות שורות לפי טבלה</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
                                      {Object.entries(r.row_counts as Record<string, number>).map(([k, v]) => (
                                        <div key={k} className="flex justify-between rounded border px-2 py-1 bg-background">
                                          <span>{TABLE_LABELS[k] ?? k}</span>
                                          <span className="font-mono">{Number(v).toLocaleString("he-IL")}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {r.error_message && (
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-1">פרטי שגיאה</div>
                                    <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-2 text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                                      {r.error_message}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
