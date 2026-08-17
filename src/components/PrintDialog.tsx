import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FileDown } from "lucide-react";

export type PrintColumn = {
  id: string;
  header: string;
  align?: "right" | "left" | "center";
  format: (row: any) => string;
};
export type PrintScope = { id: string; label: string; rows: any[] };
export type PrintTotals = { label: string; value: string; tone?: "income" | "expense" | "neutral" }[];

export type MonthPivotConfig = {
  monthField: string;   // e.g. "month" (YYYY-MM)
  labelField: string;   // e.g. "type"
  labelHeader?: string; // e.g. "סוג"
  valueFields: { key: string; label: string; tone?: "income" | "expense" | "neutral" }[];
  formatValue?: (n: number) => string;
  defaultMonth?: string; // YYYY-MM
  showTotalsColumn?: boolean;
};

export type PrintFilter = {
  id: string;
  label: string;
  options: { value: string; label: string; count?: number }[];
  apply: (row: any, value: string) => boolean;
};

export type PrintDialogProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  brand?: string;
  subtitle?: string;
  scopes: PrintScope[];
  columns: PrintColumn[];
  defaultColumns?: string[];
  totals?: PrintTotals;
  monthPivot?: MonthPivotConfig;
  filters?: PrintFilter[];
};


export function PrintDialog({
  open, onOpenChange, title, brand = "מרכז קארלין סטאלין",
  subtitle, scopes, columns, defaultColumns, totals, monthPivot, filters,
}: PrintDialogProps) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "");
  const [colIds, setColIds] = useState<string[]>(defaultColumns ?? columns.map((c) => c.id));
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [showHeader, setShowHeader] = useState(true);
  const [showSubtitle, setShowSubtitle] = useState(true);
  const [showTotals, setShowTotals] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("sm");
  const [zebra, setZebra] = useState(true);

  // Pivot state
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [pivotValueKeys, setPivotValueKeys] = useState<string[]>(
    monthPivot?.valueFields.map((v) => v.key) ?? [],
  );

  const activeScopeRaw = useMemo(() => scopes.find((s) => s.id === scopeId) ?? scopes[0], [scopes, scopeId]);
  const activeScope = useMemo(() => {
    if (!activeScopeRaw || !filters?.length) return activeScopeRaw;
    let rows = activeScopeRaw.rows;
    for (const f of filters) {
      const v = filterValues[f.id];
      if (v && v !== "__all__") rows = rows.filter((r) => f.apply(r, v));
    }
    return { ...activeScopeRaw, rows };
  }, [activeScopeRaw, filters, filterValues]);

  // Available months from active scope
  const availableMonths = useMemo(() => {
    if (!monthPivot) return [];
    const s = new Set<string>();
    (activeScope?.rows ?? []).forEach((r: any) => {
      const m = r?.[monthPivot.monthField];
      if (typeof m === "string" && m.length >= 7) s.add(m.slice(0, 7));
    });
    return Array.from(s).sort().reverse();
  }, [activeScope, monthPivot]);

  // Re-init when reopened with different scopes/columns
  useEffect(() => {
    if (open) {
      setScopeId(scopes[0]?.id ?? "");
      setColIds(defaultColumns ?? columns.map((c) => c.id));
      setFilterValues({});
      if (monthPivot) {
        setPivotValueKeys(monthPivot.valueFields.map((v) => v.key));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset month selection whenever scope changes or dialog opens
  useEffect(() => {
    if (!monthPivot || !open) return;
    const preferred = monthPivot.defaultMonth ?? currentMonth;
    const initial = availableMonths.includes(preferred)
      ? [preferred]
      : availableMonths.slice(0, 1);
    setSelectedMonths(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scopeId, monthPivot?.monthField, availableMonths.join(",")]);

  const activeCols = useMemo(() => columns.filter((c) => colIds.includes(c.id)), [columns, colIds]);

  const allColsSelected = colIds.length === columns.length;
  const toggleAllCols = () => setColIds(allColsSelected ? [] : columns.map((c) => c.id));
  const toggleCol = (id: string) =>
    setColIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleMonth = (m: string) =>
    setSelectedMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  const toggleAllMonths = () =>
    setSelectedMonths((prev) => (prev.length === availableMonths.length ? [] : [...availableMonths]));
  const toggleValueKey = (k: string) =>
    setPivotValueKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-");
    const names = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
    return `${names[Number(mm) - 1] ?? mm} ${y}`;
  };

  // Effective columns/rows for the printed table
  const { effCols, effRows } = useMemo(() => {
    if (!monthPivot) {
      return { effCols: activeCols, effRows: activeScope?.rows ?? [] };
    }
    const fmt = monthPivot.formatValue ?? ((n: number) => (n ? n.toLocaleString("he-IL") : "—"));
    const activeValueFields = monthPivot.valueFields.filter((v) => pivotValueKeys.includes(v.key));
    const monthsAsc = [...selectedMonths].sort();

    const cols: PrintColumn[] = [
      { id: "__label", header: monthPivot.labelHeader ?? "", align: "right", format: (r: any) => r.__label },
    ];
    monthsAsc.forEach((m) => {
      activeValueFields.forEach((v) => {
        cols.push({
          id: `${m}__${v.key}`,
          header: `${monthLabel(m)} · ${v.label}`,
          align: "left",
          format: (r: any) => fmt(r[`${m}__${v.key}`] ?? 0),
        });
      });
    });
    if (monthPivot.showTotalsColumn !== false) {
      activeValueFields.forEach((v) => {
        cols.push({
          id: `__total__${v.key}`,
          header: `סה״כ · ${v.label}`,
          align: "left",
          format: (r: any) => fmt(r[`__total__${v.key}`] ?? 0),
        });
      });
    }

    // Group rows by label field across selected months
    const bucket = new Map<string, any>();
    (activeScope?.rows ?? []).forEach((r: any) => {
      const m = String(r?.[monthPivot.monthField] ?? "").slice(0, 7);
      if (!monthsAsc.includes(m)) return;
      const label = String(r?.[monthPivot.labelField] ?? "—");
      if (!bucket.has(label)) bucket.set(label, { __label: label });
      const row = bucket.get(label);
      monthPivot.valueFields.forEach((v) => {
        const key = `${m}__${v.key}`;
        row[key] = (row[key] ?? 0) + (Number(r?.[v.key]) || 0);
        const tkey = `__total__${v.key}`;
        row[tkey] = (row[tkey] ?? 0) + (Number(r?.[v.key]) || 0);
      });
    });
    const rowsArr = Array.from(bucket.values()).sort((a, b) => String(a.__label).localeCompare(String(b.__label), "he"));
    return { effCols: cols, effRows: rowsArr };
  }, [monthPivot, activeCols, activeScope, selectedMonths, pivotValueKeys]);

  function buildHtml(autoPrint: boolean) {
    const fontPx = fontSize === "lg" ? 13 : fontSize === "md" ? 11 : 10;
    const headPx = fontPx + 1;
    const rows = effRows;
    const now = new Date().toLocaleString("he-IL");

    const ths = effCols
      .map((c) => `<th style="text-align:${c.align ?? "right"}">${escapeHtml(c.header)}</th>`)
      .join("");

    const trs = rows
      .map((r, i) => {
        const tds = effCols
          .map((c) => `<td style="text-align:${c.align ?? "right"}">${escapeHtml(c.format(r))}</td>`)
          .join("");
        const cls = zebra && i % 2 ? ' class="z"' : "";
        return `<tr${cls}>${tds}</tr>`;
      })
      .join("");


    const totalsHtml = showTotals && totals && totals.length
      ? `<div class="totals">${totals
          .map(
            (t) =>
              `<div class="t-item"><span class="t-label">${escapeHtml(t.label)}</span><span class="t-val ${t.tone ?? ""}">${escapeHtml(t.value)}</span></div>`,
          )
          .join("")}</div>`
      : "";

    const headerHtml = showHeader
      ? `<header>
          <div class="brand">${escapeHtml(brand)}</div>
          <div class="title">${escapeHtml(title)}</div>
          ${showSubtitle && subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}
          <div class="meta">הופק בתאריך: ${escapeHtml(now)} · ${rows.length.toLocaleString("he-IL")} שורות</div>
        </header>`
      : "";

    const footerHtml = showPageNumbers
      ? `<style>@page { @bottom-center { content: "עמוד " counter(page) " מתוך " counter(pages); font-family: Heebo, Arial; font-size: 9pt; color:#666; } }</style>`
      : "";

    return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4 ${orientation}; margin: 14mm 12mm 18mm 12mm; }
  ${footerHtml ? "" : ""}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Heebo, Arial, sans-serif; }
  body { padding: 8px 4px; }
  header { border-bottom: 2px solid #1a2b50; padding-bottom: 8px; margin-bottom: 10px; }
  .brand { color: #b88a2a; font-weight: 800; font-size: 16pt; letter-spacing: .5px; }
  .title { font-size: 13pt; font-weight: 700; margin-top: 2px; }
  .sub { font-size: 10pt; color: #444; margin-top: 2px; }
  .meta { font-size: 9pt; color: #666; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: ${fontPx}pt; table-layout: auto; }
  thead th { background: #f3f4f6; color: #1a2b50; text-align: right; padding: 6px 6px; border: 1px solid #cbd2dc; font-weight: 700; font-size: ${headPx}pt; }
  tbody td { padding: 4px 6px; border: 1px solid #dde2ea; vertical-align: middle; white-space: nowrap; }
  tbody tr.z td { background: #fafbfd; }
  tbody tr:hover td { background: #eef2f8; }
  .totals { display: flex; flex-wrap: wrap; gap: 16px; justify-content: flex-start; margin-top: 12px; padding: 10px 12px; border: 1px solid #cbd2dc; border-radius: 6px; background: #f8fafc; }
  .t-item { display: flex; gap: 6px; font-size: 10pt; }
  .t-label { color: #555; font-weight: 600; }
  .t-val { font-weight: 800; }
  .t-val.income { color: #137a3a; }
  .t-val.expense { color: #b1331a; }
  .toolbar { position: sticky; top: 0; background: #1a2b50; color: #fff; padding: 8px 12px; display: flex; gap: 8px; justify-content: flex-end; }
  .toolbar button { background: #b88a2a; color: #1a2b50; border: 0; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 700; font-family: inherit; }
  .toolbar button.alt { background: #fff; }
  .hint { font-size: 9pt; color: #fff; opacity: .85; align-self: center; margin-inline-end: auto; }
  @media print { .toolbar { display: none !important; } body { padding: 0; } }
</style>
${footerHtml}
</head>
<body>
  <div class="toolbar no-print">
    <span class="hint">תצוגה מקדימה — ניתן לבחור "שמירה כ-PDF" בתפריט ההדפסה</span>
    <button onclick="window.print()">הדפסה</button>
    <button class="alt" onclick="window.close()">סגירה</button>
  </div>
  ${headerHtml}
  <table>
    <thead><tr>${ths}</tr></thead>
    <tbody>${trs || `<tr><td colspan="${effCols.length}" style="text-align:center;padding:20px;color:#999">אין נתונים להצגה</td></tr>`}</tbody>
  </table>
  ${totalsHtml}
  ${autoPrint ? `<script>window.addEventListener('load', () => setTimeout(() => window.print(), 350));</script>` : ""}
</body>
</html>`;
  }

  function openPrintWindow(autoPrint: boolean) {
    const html = buildHtml(autoPrint);
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) {
      toast.error("חלון ההדפסה נחסם. אשר חלונות קופצים בדפדפן ונסה שוב.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    toast.success("הדוח נפתח בחלון הדפסה");
    onOpenChange(false);
  }

  const [downloading, setDownloading] = useState(false);
  async function downloadPdf() {
    setDownloading(true);
    // Render into an off-screen container inside the CURRENT document so fonts
    // and CSS are guaranteed available for html2canvas.
    const holder = document.createElement("div");
    holder.setAttribute("dir", "rtl");
    holder.style.cssText =
      "position:fixed;left:-100000px;top:0;width:" +
      (orientation === "landscape" ? "1400px" : "980px") +
      ";background:#fff;z-index:-1;";
    const html = buildHtml(false);
    const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    holder.innerHTML =
      (styleMatch ? `<style>${styleMatch[1]}</style>` : "") +
      (bodyMatch ? bodyMatch[1] : html);
    holder.querySelectorAll(".toolbar").forEach((el) => el.remove());
    document.body.appendChild(holder);
    try {
      try { await (document as any).fonts?.ready; } catch { /* noop */ }
      await new Promise((r) => setTimeout(r, 150));

      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const { jsPDF } = jspdfMod as any;

      const canvas = await html2canvas(holder, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: holder.scrollWidth,
      });

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (imgH <= pageH - margin * 2) {
        pdf.addImage(imgData, "JPEG", margin, margin, imgW, imgH);
      } else {
        const pxPerMm = canvas.width / imgW;
        const pageHpx = (pageH - margin * 2) * pxPerMm;
        let y = 0;
        let first = true;
        while (y < canvas.height) {
          const sliceH = Math.min(pageHpx, canvas.height - y);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceData = slice.toDataURL("image/jpeg", 0.95);
          const sliceHmm = sliceH / pxPerMm;
          if (!first) pdf.addPage();
          pdf.addImage(sliceData, "JPEG", margin, margin, imgW, sliceHmm);
          y += sliceH;
          first = false;
        }
      }

      const filename = `${title.replace(/[\\/:*?"<>|]+/g, "_")}.pdf`;
      pdf.save(filename);
      onOpenChange(false);
    } catch (e) {
      console.error("PDF download failed", e);
      alert("הורדת ה-PDF נכשלה. נסה שוב או השתמש בתצוגה מקדימה.");
    } finally {
      document.body.removeChild(holder);
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] p-0 !flex !flex-col gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3 border-b shrink-0">
          <DialogTitle className="text-xl">ייצוא ל-PDF</DialogTitle>
          <DialogDescription>בחר עמודות והגדרות תצוגה. ניתן לצפות בתצוגה מקדימה או להוריד קובץ PDF.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">


        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Scope */}
          <section className="space-y-2">
            <div className="text-sm font-bold">היקף הדפסה</div>
            <RadioGroup value={scopeId} onValueChange={setScopeId} className="space-y-1.5">
              {scopes.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50">
                  <RadioGroupItem value={s.id} id={`scope-${s.id}`} />
                  <span className="text-sm flex-1">{s.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{s.rows.length.toLocaleString("he-IL")}</span>
                </label>
              ))}
            </RadioGroup>
          </section>

          {/* Orientation + size */}
          <section className="space-y-2">
            <div className="text-sm font-bold">פריסה</div>
            <RadioGroup value={orientation} onValueChange={(v) => setOrientation(v as any)} className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50">
                <RadioGroupItem value="landscape" id="o-l" />
                <span className="text-sm">לרוחב (Landscape)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 hover:bg-muted/50">
                <RadioGroupItem value="portrait" id="o-p" />
                <span className="text-sm">לאורך (Portrait)</span>
              </label>
            </RadioGroup>
            <div className="text-sm font-bold mt-3">גודל טקסט בטבלה</div>
            <RadioGroup value={fontSize} onValueChange={(v) => setFontSize(v as any)} className="grid grid-cols-3 gap-2">
              {([["sm", "קטן"], ["md", "בינוני"], ["lg", "גדול"]] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer rounded-md border px-2 py-1.5 justify-center hover:bg-muted/50">
                  <RadioGroupItem value={v} id={`fs-${v}`} />
                  <span className="text-xs">{l}</span>
                </label>
              ))}
            </RadioGroup>
          </section>
        </div>

        {filters && filters.length > 0 && (
          <section className="space-y-2 border rounded-md p-3 bg-muted/20">
            <div className="text-sm font-bold">סינון נוסף בתוך ההיקף</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filters.map((f) => (
                <label key={f.id} className="text-xs space-y-1 block">
                  <span className="font-semibold text-muted-foreground">{f.label}</span>
                  <select
                    className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                    value={filterValues[f.id] ?? "__all__"}
                    onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  >
                    <option value="__all__">— הכל —</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}{o.count != null ? ` (${o.count})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              שורות אחרי סינון: <b className="tabular-nums">{activeScope?.rows.length.toLocaleString("he-IL") ?? 0}</b>
            </div>
          </section>
        )}


        <Separator />

        {/* Columns / Pivot */}
        {monthPivot ? (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">בחירת חודשים ({selectedMonths.length}/{availableMonths.length})</div>
                <Button variant="ghost" size="sm" type="button" onClick={toggleAllMonths}>
                  {selectedMonths.length === availableMonths.length ? "נקה הכל" : "בחר הכל"}
                </Button>
              </div>
              {availableMonths.length === 0 ? (
                <p className="text-xs text-muted-foreground">אין חודשים זמינים בהיקף שנבחר.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 max-h-44 overflow-auto pr-1">
                  {availableMonths.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                      <Checkbox checked={selectedMonths.includes(m)} onCheckedChange={() => toggleMonth(m)} />
                      <span className="truncate">{monthLabel(m)}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>
            <section className="space-y-2">
              <div className="text-sm font-bold">ערכים להצגה</div>
              <div className="flex flex-wrap gap-3">
                {monthPivot.valueFields.map((v) => (
                  <label key={v.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={pivotValueKeys.includes(v.key)} onCheckedChange={() => toggleValueKey(v.key)} />
                    <span>{v.label}</span>
                  </label>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">עמודות להדפסה ({colIds.length}/{columns.length})</div>
              <Button variant="ghost" size="sm" type="button" onClick={toggleAllCols}>
                {allColsSelected ? "נקה הכל" : "בחר הכל"}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 max-h-44 overflow-auto pr-1">
              {columns.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                  <Checkbox checked={colIds.includes(c.id)} onCheckedChange={() => toggleCol(c.id)} />
                  <span className="truncate">{c.header}</span>
                </label>
              ))}
            </div>
          </section>
        )}


        <Separator />

        {/* Page extras */}
        <section className="space-y-2">
          <div className="text-sm font-bold">תוספות לעמוד</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5">
            <ToggleRow checked={showHeader} onChange={setShowHeader} label="כותרת עליונה (מוסד + שם דוח)" />
            <ToggleRow checked={showSubtitle} onChange={setShowSubtitle} label="טווח תאריכים / כותרת משנה" />
            <ToggleRow checked={!!totals?.length && showTotals} onChange={setShowTotals} label="סיכומים בתחתית" disabled={!totals?.length} />
            <ToggleRow checked={showPageNumbers} onChange={setShowPageNumbers} label="מספור עמודים + תאריך הדפסה" />
            <ToggleRow checked={zebra} onChange={setZebra} label="צביעת שורות מתחלפת (Zebra)" />
          </div>
        </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 p-4 border-t bg-background shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button variant="outline" onClick={() => openPrintWindow(false)} disabled={!effCols.length || downloading}>
            <FileDown className="w-4 h-4 ml-1" /> תצוגה מקדימה
          </Button>
          <Button onClick={downloadPdf} disabled={!effCols.length || downloading}>
            <FileDown className="w-4 h-4 ml-1" /> {downloading ? "מייצא..." : "הורדת PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={"flex items-center gap-2 text-sm py-1 " + (disabled ? "opacity-40" : "cursor-pointer")}>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function escapeHtml(v: any): string {
  const s = v == null ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
