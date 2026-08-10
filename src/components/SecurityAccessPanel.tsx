import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Ban, Trash2, Download } from "lucide-react";
import {
  saveDownloadCode,
  getDownloadCodeStatus,
  revealDownloadCode,
  listSecurityEvents,
  securitySummary,
  purgeSecurityLogs,
  listBlockedIps,
  blockIpAddress,
  unblockIpAddress,
} from "@/lib/security.functions";

const EVENT_LABELS: Record<string, string> = {
  login: "התחברות",
  logout: "התנתקות",
  idle_logout: "ניתוק אוטומטי",
  failed: "ניסיון כושל",
  lockout: "נעילת חשבון",
};

function fmt(d: string) {
  return new Date(d).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
}

export function SecurityAccessPanel() {
  const qc = useQueryClient();
  const setCode = useServerFn(saveDownloadCode);
  const fetchStatus = useServerFn(getDownloadCodeStatus);
  const reveal = useServerFn(revealDownloadCode);
  const fetchEvents = useServerFn(listSecurityEvents);
  const fetchSummary = useServerFn(securitySummary);
  const purge = useServerFn(purgeSecurityLogs);
  const fetchIps = useServerFn(listBlockedIps);
  const doBlock = useServerFn(blockIpAddress);
  const doUnblock = useServerFn(unblockIpAddress);

  const [code, setCodeValue] = useState("");
  const [showCode, setShowCode] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [newIp, setNewIp] = useState("");
  const [newIpReason, setNewIpReason] = useState("");

  const { data: status } = useQuery({ queryKey: ["download-code-status-admin"], queryFn: () => fetchStatus() });
  const { data: revealed } = useQuery({
    queryKey: ["download-code-reveal", showCode],
    queryFn: () => reveal(),
    enabled: showCode,
  });

  const { data: summary } = useQuery({ queryKey: ["security-summary"], queryFn: () => fetchSummary() });

  const filters = useMemo(
    () => ({
      from: from ? new Date(from + "T00:00:00").toISOString() : null,
      to: to ? new Date(to + "T23:59:59").toISOString() : null,
      search: search.trim() || null,
      eventType,
      page,
      pageSize,
    }),
    [from, to, search, eventType, page],
  );

  const { data: log } = useQuery({
    queryKey: ["security-events", filters],
    queryFn: () => fetchEvents({ data: filters }),
  });

  const { data: blocked = [] } = useQuery({ queryKey: ["blocked-ips"], queryFn: () => fetchIps() });

  const save = useMutation({
    mutationFn: async () => await setCode({ data: { code: code.trim() } }),
    onSuccess: (r: any) => {
      toast.success(r?.enabled ? "קוד ההורדה עודכן" : "קוד ההורדה בוטל — ההורדה פתוחה");
      setCodeValue("");
      qc.invalidateQueries({ queryKey: ["download-code-status-admin"] });
      qc.invalidateQueries({ queryKey: ["download-code-reveal"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה בשמירת הקוד"),
  });

  const blockMut = useMutation({
    mutationFn: async (v: { ip: string; reason: string | null }) => await doBlock({ data: v }),
    onSuccess: () => {
      toast.success("הכתובת נחסמה");
      setNewIp("");
      setNewIpReason("");
      qc.invalidateQueries({ queryKey: ["blocked-ips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה בחסימה"),
  });

  const unblockMut = useMutation({
    mutationFn: async (id: string) => await doUnblock({ data: { id } }),
    onSuccess: () => {
      toast.success("החסימה הוסרה");
      qc.invalidateQueries({ queryKey: ["blocked-ips"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  const purgeMut = useMutation({
    mutationFn: async () => await purge(),
    onSuccess: (r: any) => {
      toast.success(`נמחקו ${(r?.loginEventsDeleted ?? 0) + (r?.failedDeleted ?? 0)} רשומות ישנות`);
      qc.invalidateQueries({ queryKey: ["security-events"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  function exportCsv() {
    const rows = log?.rows ?? [];
    const header = ["תאריך", "סוג", "משתמש", "IP", "מיקום", "דפדפן"];
    const lines = rows.map((r: any) =>
      [
        fmt(r.created_at),
        EVENT_LABELS[r.event_type] ?? r.event_type,
        r.email ?? "",
        r.ip ?? "",
        [r.city, r.country].filter(Boolean).join(" "),
        (r.user_agent ?? "").replace(/[",\n]/g, " "),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `login-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = log?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>קוד גישה להורדת האפליקציה</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            מצב נוכחי: {status?.required ? "נדרש קוד להורדה" : "ההורדה פתוחה ללא קוד"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCode((s) => !s)}>
              {showCode ? <EyeOff className="w-4 h-4 ml-1" /> : <Eye className="w-4 h-4 ml-1" />}
              {showCode ? "הסתר קוד נוכחי" : "הצג קוד נוכחי"}
            </Button>
            {showCode && (
              <span className="text-sm font-mono" dir="ltr">
                {revealed?.code
                  ? revealed.code
                  : revealed?.legacy
                    ? "— הקוד הישן שמור בהצפנה חד-כיוונית, יש לקבוע קוד חדש כדי לצפות בו"
                    : revealed?.required === false
                      ? "— אין קוד מוגדר"
                      : "..."}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="קוד חדש (השאר ריק כדי לבטל)"
              value={code}
              onChange={(e) => setCodeValue(e.target.value)}
            />
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "שומר..." : "שמור קוד"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "התחברויות היום", value: summary?.todayLogins ?? 0 },
          { label: "משתמשים פעילים (7 ימים)", value: summary?.activeUsersWeek ?? 0 },
          { label: "ניסיונות כושלים (24ש')", value: summary?.failed24h ?? 0 },
          { label: "מכשירים חדשים (7 ימים)", value: summary?.newDevicesWeek ?? 0 },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>יומן התחברויות ואירועי אבטחה</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">מתאריך</Label>
              <Input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">עד תאריך</Label>
              <Input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">סוג אירוע</Label>
              <Select value={eventType} onValueChange={(v) => { setPage(1); setEventType(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  <SelectItem value="login">התחברות</SelectItem>
                  <SelectItem value="logout">התנתקות</SelectItem>
                  <SelectItem value="idle_logout">ניתוק אוטומטי</SelectItem>
                  <SelectItem value="failed">ניסיון כושל</SelectItem>
                  <SelectItem value="lockout">נעילת חשבון</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">חיפוש (משתמש / IP / מיקום)</Label>
              <Input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 ml-1" />ייצוא</Button>
              <Button variant="outline" onClick={() => purgeMut.mutate()} disabled={purgeMut.isPending}>
                ניקוי מעל 12 חודשים
              </Button>
            </div>
          </div>

          <div className="border rounded-lg divide-y max-h-[520px] overflow-auto">
            {(log?.rows ?? []).length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">אין נתונים להצגה.</div>
            )}
            {(log?.rows ?? []).map((e: any) => (
              <div key={`${e.event_type}-${e.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {e.email ?? "—"}
                    <Badge
                      variant={e.event_type === "failed" || e.event_type === "lockout" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {EVENT_LABELS[e.event_type] ?? e.event_type}
                    </Badge>
                    {e.is_new_device && <Badge variant="destructive" className="text-[10px]">מכשיר חדש</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-[420px]">{e.user_agent ?? ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground text-left">
                    <div>{fmt(e.created_at)}</div>
                    <div dir="ltr">{e.ip ?? "—"}</div>
                    <div>{[e.city, e.country].filter(Boolean).join(", ")}</div>
                  </div>
                  {e.ip && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="חסימת כתובת IP"
                      onClick={() => blockMut.mutate({ ip: e.ip, reason: `מהיומן — ${EVENT_LABELS[e.event_type] ?? e.event_type}` })}
                    >
                      <Ban className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">סה"כ {total} רשומות</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>הקודם</Button>
              <span>{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>הבא</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>כתובות IP חסומות</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-[200px]" dir="ltr" placeholder="כתובת IP" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
            <Input className="max-w-xs" placeholder="סיבה (רשות)" value={newIpReason} onChange={(e) => setNewIpReason(e.target.value)} />
            <Button
              onClick={() => blockMut.mutate({ ip: newIp.trim(), reason: newIpReason.trim() || null })}
              disabled={!newIp.trim() || blockMut.isPending}
            >
              <Ban className="w-4 h-4 ml-1" />חסום
            </Button>
          </div>
          <div className="border rounded-lg divide-y">
            {blocked.length === 0 && <div className="p-4 text-sm text-muted-foreground">אין כתובות חסומות.</div>}
            {blocked.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <div className="font-mono" dir="ltr">{b.ip}</div>
                  <div className="text-xs text-muted-foreground">{b.reason ?? ""} · {fmt(b.created_at)}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => unblockMut.mutate(b.id)} title="הסרת חסימה">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
