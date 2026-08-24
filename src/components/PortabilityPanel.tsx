import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Database, FileJson, Loader2, ShieldCheck } from "lucide-react";
import {
  getPortabilityCounts,
  getPortabilityPage,
  getPortabilitySchema,
} from "@/lib/portability.functions";
import { PORTABLE_TABLES, TABLE_LABELS_HE, EXPORT_PAGE_SIZE } from "@/lib/portability-tables";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `'${s.replace(/'/g, "''")}'`;
}

function toSql(dump: Record<string, any[]>): string {
  const out: string[] = [
    "-- גיבוי מלא של בסיס הנתונים — מרכז קארלין סטולין",
    `-- נוצר: ${new Date().toISOString()}`,
    "-- שחזור: להריץ על בסיס נתונים עם אותו מבנה טבלאות (ראו קובץ ה-schema).",
    "BEGIN;",
    "SET session_replication_role = replica; -- מבטל זמנית בדיקות מפתחות זרים",
    "",
  ];
  for (const table of PORTABLE_TABLES) {
    const rows = dump[table];
    if (!rows || rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    out.push(`-- ${TABLE_LABELS_HE[table] ?? table} (${rows.length})`);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const values = chunk
        .map((r) => `  (${cols.map((c) => sqlLiteral(r[c])).join(", ")})`)
        .join(",\n");
      out.push(
        `INSERT INTO public.${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES\n${values}\nON CONFLICT DO NOTHING;`,
      );
    }
    out.push("");
  }
  out.push("SET session_replication_role = DEFAULT;", "COMMIT;");
  return out.join("\n");
}

export function PortabilityPanel() {
  const countsFn = useServerFn(getPortabilityCounts);
  const pageFn = useServerFn(getPortabilityPage);
  const schemaFn = useServerFn(getPortabilitySchema);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState("");

  const { data: counts, isLoading } = useQuery({
    queryKey: ["portability_counts"],
    queryFn: () => countsFn(),
    staleTime: 60_000,
  });

  const totalRows = counts
    ? Object.values(counts).reduce((a: number, b: number) => a + Math.max(0, b), 0)
    : 0;

  async function collect(): Promise<Record<string, any[]>> {
    const dump: Record<string, any[]> = {};
    let done = 0;
    for (const table of PORTABLE_TABLES) {
      setCurrent(TABLE_LABELS_HE[table] ?? table);
      const rows: any[] = [];
      let offset = 0;
      // Page until the server reports a short page.
      for (;;) {
        const res = await pageFn({ data: { table, offset } });
        rows.push(...res.rows);
        done += res.rows.length;
        if (totalRows > 0) setProgress(Math.min(99, Math.round((done / totalRows) * 100)));
        if (res.done) break;
        offset += EXPORT_PAGE_SIZE;
      }
      dump[table] = rows;
    }
    setProgress(100);
    return dump;
  }

  async function runExport(format: "json" | "sql") {
    setBusy(true);
    setProgress(0);
    try {
      const dump = await collect();
      if (format === "json") {
        const payload = {
          exported_at: new Date().toISOString(),
          source: "Lovable Cloud (Supabase/Postgres)",
          tables: dump,
        };
        downloadBlob(JSON.stringify(payload, null, 1), `karlin-data-${stamp()}.json`, "application/json");
      } else {
        downloadBlob(toSql(dump), `karlin-data-${stamp()}.sql`, "application/sql");
      }
      toast.success("הייצוא הושלם והקובץ ירד למחשב");
    } catch (err: any) {
      toast.error(`שגיאה בייצוא: ${err?.message ?? err}`);
    } finally {
      setBusy(false);
      setCurrent("");
    }
  }

  async function exportSchema() {
    setBusy(true);
    try {
      const schema = await schemaFn();
      downloadBlob(JSON.stringify(schema, null, 2), `karlin-schema-${stamp()}.json`, "application/json");
      toast.success("מבנה בסיס הנתונים ירד למחשב");
    } catch (err: any) {
      toast.error(`שגיאה: ${err?.message ?? err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>מוכנות למעבר — ייצוא מלא של המערכת</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            כאן אפשר להוריד עותק מלא ועצמאי של <b>כל</b> הנתונים במערכת — לא רק דוח,
            אלא הנתונים הגולמיים עצמם. עם הקבצים האלה אפשר להקים את המערכת מחדש
            בכל תשתית אחרת, בלי תלות בשירות הנוכחי.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pr-5">
            <li><b>קובץ נתונים (JSON)</b> — כל הטבלאות והשורות כפי שהן. מתאים לשמירה ולעיבוד.</li>
            <li><b>קובץ שחזור (SQL)</b> — פקודות הכנסה מוכנות. מריצים על בסיס נתונים חדש והנתונים חוזרים.</li>
            <li><b>מבנה בסיס הנתונים (Schema)</b> — הגדרות הטבלאות, האינדקסים, כללי הגישה והפונקציות.</li>
          </ul>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">מחשב היקף נתונים…</div>
          ) : (
            <div className="text-sm">
              סה״כ רשומות לייצוא: <b>{totalRows.toLocaleString("he-IL")}</b>
            </div>
          )}

          {busy && (
            <div className="space-y-2">
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground">
                {current ? `מייצא: ${current}` : "מכין קובץ…"} ({progress}%)
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runExport("json")} disabled={busy}>
              {busy ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileJson className="ml-2 h-4 w-4" />}
              הורד קובץ נתונים (JSON)
            </Button>
            <Button variant="outline" onClick={() => runExport("sql")} disabled={busy}>
              <Database className="ml-2 h-4 w-4" />
              הורד קובץ שחזור (SQL)
            </Button>
            <Button variant="outline" onClick={exportSchema} disabled={busy}>
              <Download className="ml-2 h-4 w-4" />
              הורד מבנה בסיס נתונים
            </Button>
          </div>
        </CardContent>
      </Card>

      {counts && (
        <Card>
          <CardHeader>
            <CardTitle>מה נכלל בייצוא</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {PORTABLE_TABLES.map((t) => (
                <div key={t} className="flex justify-between gap-2 rounded-md border p-2">
                  <span className="truncate">{TABLE_LABELS_HE[t] ?? t}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {counts[t] >= 0 ? counts[t].toLocaleString("he-IL") : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            צעדים לעצמאות מלאה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p><b>1. הקוד</b> — לחיבור עותק של הקוד לגיטהאב: בפינה הימנית העליונה של המסך יש כפתור GitHub → Connect. מאותו רגע כל שינוי נשמר גם אצלך.</p>
          <p><b>2. הנתונים</b> — להוריד מכאן את קובץ ה-JSON ואת קובץ ה-SQL, ולשמור אותם במקום בטוח (מומלץ גם בדרייב). בנוסף פועל הגיבוי היומי האוטומטי.</p>
          <p><b>3. המבנה</b> — להוריד את קובץ מבנה בסיס הנתונים. הוא מאפשר להקים בסיס נתונים זהה בכל מקום אחר.</p>
          <p><b>4. הדומיין</b> — אם נרכש דומיין, הוא רשום על שמכם ואפשר להפנות אותו לכל תשתית בעתיד.</p>
          <p className="text-foreground">
            עם שלושת הקבצים האלה + הקוד בגיטהאב, המערכת ניתנת להקמה מחדש בכל שירות אחר.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
