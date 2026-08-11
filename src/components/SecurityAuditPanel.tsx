import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, ChevronDown, ChevronLeft, Trash2, ShieldCheck, ShieldAlert, XCircle, ExternalLink, Wrench, Copy } from "lucide-react";
import {
  triggerSecurityAuditNow,
  listSecurityAuditRuns,
  deleteSecurityAuditRun,
  autofixSecurityConfig,
} from "@/lib/security-audit.functions";

function fmt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("he-IL");
}

const SEV_LABELS: Record<string, string> = {
  critical: "קריטי",
  high: "גבוה",
  moderate: "בינוני",
  low: "נמוך",
};

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  moderate: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
};

export function SecurityAuditPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listSecurityAuditRuns);
  const trigger = useServerFn(triggerSecurityAuditNow);
  const del = useServerFn(deleteSecurityAuditRun);
  const autofix = useServerFn(autofixSecurityConfig);
  const [openId, setOpenId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["security_audit_runs"],
    queryFn: () => list(),
  });

  const runNow = useMutation({
    mutationFn: async () => {
      setRunning(true);
      return await trigger();
    },
    onSuccess: (r: any) => {
      if (r?.ok === false) toast.error(`הסריקה נכשלה: ${r.error}`);
      else if (r?.vulnerabilities > 0) toast.warning(`נמצאו ${r.vulnerabilities} פגיעויות`);
      else toast.success("לא נמצאו פגיעויות");
      qc.invalidateQueries({ queryKey: ["security_audit_runs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה"),
    onSettled: () => setRunning(false),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => await del({ data: { id } }),
    onSuccess: () => {
      toast.success("נמחק");
      qc.invalidateQueries({ queryKey: ["security_audit_runs"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה"),
  });

  const latest = runs?.[0] as any | undefined;
  const latestVulns: any[] = latest?.report_json?.vulnerabilities ?? [];

  function buildFixPrompt(vulns: any[]) {
    const lines = vulns.map((v: any, i: number) =>
      `${i + 1}. ${v.package}@${v.version} — חומרה: ${SEV_LABELS[v.severity] || v.severity}` +
      (v.fixed_in ? ` — תיקון בגרסה: ${v.fixed_in}` : " — אין גרסת תיקון ידועה") +
      (v.summary ? `\n   ${v.summary}` : "") +
      (v.reference ? `\n   ${v.reference}` : "")
    );
    return [
      "בבקשה תקן את פגיעויות ה-npm הבאות שנמצאו בסריקת האבטחה:",
      "",
      ...lines,
      "",
      "עבור על כל אחת, שדרג את החבילה ל-fixed_in (או לגרסה תואמת), ואם אין תיקון — הצע חלופה או אמור מפורשות שאי אפשר לתקן. הרץ סריקה חוזרת בסוף.",
    ].join("\n");
  }

  async function copyFixPrompt() {
    if (!latestVulns.length) return;
    const text = buildFixPrompt(latestVulns);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("בקשת התיקון הועתקה — הדבק בצ׳אט של Lovable כדי שאתקן את החבילות");
    } catch {
      toast.error("לא ניתן להעתיק ללוח");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>סריקת אבטחה יומית</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            סריקה אוטומטית של תלויות npm כל יום בשעה 09:00. בודקת פגיעויות ידועות מול מאגר OSV.dev.
          </p>
        </div>
        <div className="flex gap-2">
          {latestVulns.length > 0 && (
            <Button variant="default" onClick={copyFixPrompt} className="bg-orange-600 hover:bg-orange-700">
              <Wrench className="w-4 h-4 ml-2" />
              תקן דרך Lovable ({latestVulns.length})
            </Button>
          )}
          <Button onClick={() => runNow.mutate()} disabled={running} variant="outline">
            {running ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <PlayCircle className="w-4 h-4 ml-2" />}
            הרץ סריקה עכשיו
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold mb-2">ריצות אחרונות</h3>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground">טוען…</div>
        ) : !runs?.length ? (
          <div className="text-center py-6 text-muted-foreground">אין ריצות עדיין</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>תאריך</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>קריטי</TableHead>
                <TableHead>גבוה</TableHead>
                <TableHead>בינוני</TableHead>
                <TableHead>נמוך</TableHead>
                <TableHead>מקור</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r: any) => (
                <Fragment key={r.id}>
                  <TableRow>
                    <TableCell>
                      <button
                        onClick={() => setOpenId(openId === r.id ? null : r.id)}
                        className="p-1"
                        aria-label="הרחב"
                      >
                        {openId === r.id ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                    </TableCell>
                    <TableCell>{fmt(r.ran_at)}</TableCell>
                    <TableCell>
                      {r.status === "ok" && (
                        <Badge className="bg-green-600 text-white"><ShieldCheck className="w-3 h-3 ml-1" />תקין</Badge>
                      )}
                      {r.status === "vulnerabilities" && (
                        <Badge className="bg-orange-500 text-white"><ShieldAlert className="w-3 h-3 ml-1" />נמצאו פגיעויות</Badge>
                      )}
                      {r.status === "failed" && (
                        <Badge className="bg-red-600 text-white"><XCircle className="w-3 h-3 ml-1" />נכשל</Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.critical_count || "—"}</TableCell>
                    <TableCell>{r.high_count || "—"}</TableCell>
                    <TableCell>{r.moderate_count || "—"}</TableCell>
                    <TableCell>{r.low_count || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.triggered_by === "cron" ? "אוטומטי" : "ידני"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => delMut.mutate(r.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {openId === r.id && (
                    <TableRow>
                      <TableCell colSpan={9} className="bg-muted/30">
                        {r.error_message ? (
                          <div className="p-3 text-red-700">{r.error_message}</div>
                        ) : r.report_json?.vulnerabilities?.length ? (
                          <div className="p-3 space-y-2">
                            <div className="text-sm text-muted-foreground">
                              נסרקו {r.total_dependencies} חבילות
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>חבילה</TableHead>
                                  <TableHead>גרסה</TableHead>
                                  <TableHead>חומרה</TableHead>
                                  <TableHead>תיקון בגרסה</TableHead>
                                  <TableHead>תיאור</TableHead>
                                  <TableHead>קישור</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {r.report_json.vulnerabilities.map((v: any, i: number) => (
                                  <TableRow key={i}>
                                    <TableCell className="font-mono text-xs">{v.package}</TableCell>
                                    <TableCell className="font-mono text-xs">{v.version}</TableCell>
                                    <TableCell>
                                      <Badge className={SEV_COLORS[v.severity] || ""}>
                                        {SEV_LABELS[v.severity] || v.severity}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{v.fixed_in || "—"}</TableCell>
                                    <TableCell className="text-xs max-w-md">{v.summary}</TableCell>
                                    <TableCell>
                                      {v.reference && (
                                        <a href={v.reference} target="_blank" rel="noreferrer" className="text-blue-600">
                                          <ExternalLink className="w-4 h-4" />
                                        </a>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="p-3 text-green-700">לא נמצאו פגיעויות בסריקה זו ✓</div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
