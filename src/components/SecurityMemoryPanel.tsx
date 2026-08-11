import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Plus, Trash2, ShieldCheck } from "lucide-react";
import {
  getSecurityMemory,
  saveSecurityMemory,
  listAcceptedFindings,
  saveAcceptedFinding,
  deleteAcceptedFinding,
} from "@/lib/security-memory.functions";

export function SecurityMemoryCard() {
  const qc = useQueryClient();
  const get = useServerFn(getSecurityMemory);
  const save = useServerFn(saveSecurityMemory);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["security_memory"], queryFn: () => get() });

  useEffect(() => {
    if (data && !dirty) setContent((data as any).content ?? "");
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const mut = useMutation({
    mutationFn: async () => await save({ data: { content } }),
    onSuccess: () => {
      setDirty(false);
      toast.success("זיכרון האבטחה נשמר");
      qc.invalidateQueries({ queryKey: ["security_memory"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>זיכרון אבטחה</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            מסמך המדיניות של המערכת: מה אסור שיקרה, מה מוגן, ואילו סיכונים אושרו במכוון. ניתן לערוך ולשמור מכאן.
          </p>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !dirty}>
          {mut.isPending ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Save className="w-4 h-4 ml-2" />}
          שמור
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground">טוען…</div>
        ) : (
          <>
            <Textarea
              dir="rtl"
              rows={14}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              className="font-mono text-sm leading-6"
            />
            {(data as any)?.updated_at && (
              <p className="text-xs text-muted-foreground mt-2">
                עודכן לאחרונה: {new Date((data as any).updated_at).toLocaleString("he-IL")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const SEV_LABELS: Record<string, string> = {
  critical: "קריטי",
  high: "גבוה",
  moderate: "בינוני",
  low: "נמוך",
};

export function AcceptedFindingsCard() {
  const qc = useQueryClient();
  const list = useServerFn(listAcceptedFindings);
  const save = useServerFn(saveAcceptedFinding);
  const del = useServerFn(deleteAcceptedFinding);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ finding_key: "", title: "", reason: "", severity: "low" });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["security_accepted_findings"],
    queryFn: () => list(),
  });

  const saveMut = useMutation({
    mutationFn: async (v: any) => await save({ data: v }),
    onSuccess: () => {
      toast.success("נשמר");
      setAdding(false);
      setDraft({ finding_key: "", title: "", reason: "", severity: "low" });
      qc.invalidateQueries({ queryKey: ["security_accepted_findings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => await del({ data: { id } }),
    onSuccess: () => {
      toast.success("הוסר — הממצא יופיע שוב כבעיה בסריקה הבאה");
      qc.invalidateQueries({ queryKey: ["security_accepted_findings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ממצאים מאושרים במכוון
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            התראות שנבדקו ואושרו כהתנהגות רצויה. הן מוצגות כאן בנפרד ואינן נחשבות כבעיה בסריקה.
          </p>
        </div>
        <Button variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="w-4 h-4 ml-2" />
          הוסף ממצא מאושר
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="grid gap-2 md:grid-cols-4 border rounded-md p-3 bg-muted/30">
            <Input
              placeholder="מזהה ממצא (finding id)"
              value={draft.finding_key}
              onChange={(e) => setDraft({ ...draft, finding_key: e.target.value })}
            />
            <Input
              placeholder="כותרת"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
            <Input
              className="md:col-span-2"
              placeholder="הסבר מדוע זה תקין"
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
            <div className="md:col-span-4 flex gap-2">
              <Button
                size="sm"
                disabled={!draft.finding_key || !draft.title || saveMut.isPending}
                onClick={() => saveMut.mutate(draft)}
              >
                שמור
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                ביטול
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground">טוען…</div>
        ) : !rows?.length ? (
          <div className="text-center py-6 text-muted-foreground">אין ממצאים מאושרים</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>כותרת</TableHead>
                <TableHead>מזהה</TableHead>
                <TableHead>חומרה</TableHead>
                <TableHead>הסבר</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows as any[]).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{r.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.finding_key}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{SEV_LABELS[r.severity] || r.severity}</Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-lg">{r.reason}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => delMut.mutate(r.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
