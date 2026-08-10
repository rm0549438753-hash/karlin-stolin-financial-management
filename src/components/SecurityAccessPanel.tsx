import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listLoginEvents, saveDownloadCode, getDownloadCodeStatus } from "@/lib/security.functions";

export function SecurityAccessPanel() {
  const qc = useQueryClient();
  const fetchEvents = useServerFn(listLoginEvents);
  const setCode = useServerFn(saveDownloadCode);
  const fetchStatus = useServerFn(getDownloadCodeStatus);
  const [code, setCodeValue] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["login-events"],
    queryFn: () => fetchEvents(),
  });

  const { data: status } = useQuery({
    queryKey: ["download-code-status-admin"],
    queryFn: () => fetchStatus(),
  });

  const save = useMutation({
    mutationFn: async () => await setCode({ data: { code: code.trim() } }),
    onSuccess: (r: any) => {
      toast.success(r?.enabled ? "קוד ההורדה עודכן" : "קוד ההורדה בוטל — ההורדה פתוחה");
      setCodeValue("");
      qc.invalidateQueries({ queryKey: ["download-code-status-admin"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה בשמירת הקוד"),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>קוד גישה להורדת האפליקציה</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            מצב נוכחי: {status?.required ? "נדרש קוד להורדה" : "ההורדה פתוחה ללא קוד"}
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

      <Card>
        <CardHeader><CardTitle>יומן התחברויות (100 אחרונות)</CardTitle></CardHeader>
        <CardContent>
          <div className="border rounded-lg divide-y max-h-[480px] overflow-auto">
            {events.length === 0 && <div className="p-4 text-sm text-muted-foreground">אין נתונים עדיין.</div>}
            {events.map((e: any) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    {e.email ?? "—"}
                    {e.is_new_device && <Badge variant="destructive" className="text-[10px]">מכשיר חדש</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate max-w-[420px]">{e.user_agent ?? ""}</div>
                </div>
                <div className="text-xs text-muted-foreground text-left">
                  <div>{new Date(e.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</div>
                  <div dir="ltr">{e.ip ?? "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
