import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, ShieldAlert, XCircle, ExternalLink, PlayCircle, Loader2, TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart, Bar } from "recharts";
import { listSecurityAuditRuns, triggerSecurityAuditNow } from "@/lib/security-audit.functions";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/security-audit")({
  component: SecurityAuditHistoryPage,
});

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

function fmt(v: string | null) {
  return v ? new Date(v).toLocaleString("he-IL") : "—";
}
function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

function SecurityAuditHistoryPage() {
  const { data: role } = useUserRole();
  const list = useServerFn(listSecurityAuditRuns);
  const trigger = useServerFn(triggerSecurityAuditNow);
  const [running, setRunning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ["security_audit_runs"],
    queryFn: () => list(),
  });

  const chartData = useMemo(() => {
    return [...runs]
      .filter((r: any) => r.status !== "failed")
      .sort((a: any, b: any) => new Date(a.ran_at).getTime() - new Date(b.ran_at).getTime())
      .map((r: any) => ({
        date: fmtDate(r.ran_at),
        critical: r.critical_count,
        high: r.high_count,
        moderate: r.moderate_count,
        low: r.low_count,
        total: r.critical_count + r.high_count + r.moderate_count + r.low_count,
      }));
  }, [runs]);

  const stats = useMemo(() => {
    const latest = runs[0] as any;
    const okCount = runs.filter((r: any) => r.status === "ok").length;
    const vulnCount = runs.filter((r: any) => r.status === "vulnerabilities").length;
    const failCount = runs.filter((r: any) => r.status === "failed").length;
    return { latest, okCount, vulnCount, failCount, total: runs.length };
  }, [runs]);

  const selected = useMemo(
    () => runs.find((r: any) => r.id === selectedId) as any,
    [runs, selectedId],
  );

  async function runNow() {
    if (!role?.isAdmin && !role?.isFullViewer) return;
    setRunning(true);
    try {
      const r: any = await trigger();
      if (r?.ok === false) toast.error(`הסריקה נכשלה: ${r.error}`);
      else if (r?.vulnerabilities > 0) toast.warning(`נמצאו ${r.vulnerabilities} פגיעויות`);
      else toast.success("לא נמצאו פגיעויות");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell title="היסטוריית סריקות אבטחה">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            סקירת סריקות תלויות npm יומיות ומעקב אחר פגיעויות לאורך זמן
          </p>
          <div className="flex gap-2">
            {role?.isAdmin && (
              <Button onClick={runNow} disabled={running}>
                {running ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <PlayCircle className="w-4 h-4 ml-2" />}
                הרץ סריקה עכשיו
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/settings">להגדרות</Link>
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">סך סריקות</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">תקינות</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-green-600">{stats.okCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">עם פגיעויות</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-orange-600">{stats.vulnCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">נכשלו</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-red-600">{stats.failCount}</div></CardContent>
          </Card>
        </div>

        {/* Latest run */}
        {stats.latest && (
          <Card>
            <CardHeader><CardTitle>סריקה אחרונה — {fmt(stats.latest.ran_at)}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 flex-wrap">
                {stats.latest.status === "ok" && (
                  <Badge className="bg-green-600 text-white text-base py-1"><ShieldCheck className="w-4 h-4 ml-1" />תקין</Badge>
                )}
                {stats.latest.status === "vulnerabilities" && (
                  <Badge className="bg-orange-500 text-white text-base py-1"><ShieldAlert className="w-4 h-4 ml-1" />נמצאו פגיעויות</Badge>
                )}
                {stats.latest.status === "failed" && (
                  <Badge className="bg-red-600 text-white text-base py-1"><XCircle className="w-4 h-4 ml-1" />נכשל</Badge>
                )}
                <div className="text-sm text-muted-foreground">
                  נסרקו {stats.latest.total_dependencies} חבילות
                </div>
                {(["critical", "high", "moderate", "low"] as const).map((s) => {
                  const v = stats.latest[`${s}_count`];
                  return v > 0 ? (
                    <div key={s} className="flex items-center gap-2">
                      <Badge className={SEV_COLORS[s]}>{SEV_LABELS[s]}</Badge>
                      <span className="font-bold">{v}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        {chartData.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />מגמת פגיעויות</CardTitle></CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" reversed />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="critical" name="קריטי" stroke="#dc2626" strokeWidth={2} />
                    <Line type="monotone" dataKey="high" name="גבוה" stroke="#ea580c" strokeWidth={2} />
                    <Line type="monotone" dataKey="moderate" name="בינוני" stroke="#eab308" strokeWidth={2} />
                    <Line type="monotone" dataKey="low" name="נמוך" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>סך פגיעויות לסריקה</CardTitle></CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" reversed />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="סך פגיעויות" fill="#0d3b66" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History table */}
        <Card>
          <CardHeader><CardTitle>כל הסריקות ({runs.length})</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-6 text-muted-foreground">טוען…</div>
            ) : !runs.length ? (
              <div className="text-center py-6 text-muted-foreground">אין ריצות עדיין</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>קריטי</TableHead>
                    <TableHead>גבוה</TableHead>
                    <TableHead>בינוני</TableHead>
                    <TableHead>נמוך</TableHead>
                    <TableHead>חבילות שנסרקו</TableHead>
                    <TableHead>מקור</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r: any) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                    >
                      <TableCell>{fmt(r.ran_at)}</TableCell>
                      <TableCell>
                        {r.status === "ok" && <Badge className="bg-green-600 text-white">תקין</Badge>}
                        {r.status === "vulnerabilities" && <Badge className="bg-orange-500 text-white">פגיעויות</Badge>}
                        {r.status === "failed" && <Badge className="bg-red-600 text-white">נכשל</Badge>}
                      </TableCell>
                      <TableCell>{r.critical_count || "—"}</TableCell>
                      <TableCell>{r.high_count || "—"}</TableCell>
                      <TableCell>{r.moderate_count || "—"}</TableCell>
                      <TableCell>{r.low_count || "—"}</TableCell>
                      <TableCell>{r.total_dependencies || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.triggered_by === "cron" ? "אוטומטי" : "ידני"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>פירוט סריקה — {fmt(selected.ran_at)}</CardTitle>
            </CardHeader>
            <CardContent>
              {selected.error_message ? (
                <div className="text-red-700">{selected.error_message}</div>
              ) : selected.report_json?.vulnerabilities?.length ? (
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
                    {selected.report_json.vulnerabilities.map((v: any, i: number) => (
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
                            <a href={v.reference} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-green-700">לא נמצאו פגיעויות בסריקה זו ✓</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
