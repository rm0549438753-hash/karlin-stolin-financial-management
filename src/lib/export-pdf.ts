/**
 * Open a printable window with an RTL Hebrew-friendly HTML table and trigger
 * the browser's print dialog. The user can choose "Save as PDF" from the
 * dialog. This approach renders Hebrew perfectly (unlike jsPDF's default
 * fonts) and requires no extra dependencies.
 */
export function exportRowsAsPdf(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const w = window.open("", "_blank", "width=1024,height=768");
  if (!w) return;

  const esc = (v: any) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const thead = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const tbody = rows
    .map(
      (r) =>
        "<tr>" +
        r.map((c) => `<td>${esc(c)}</td>`).join("") +
        "</tr>",
    )
    .join("");

  w.document.write(`<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Assistant","Rubik","Segoe UI",Arial,sans-serif; direction: rtl; color: #0f172a; margin: 0; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #0f2a4a; color: #fff; text-align: right; padding: 6px 8px; border: 1px solid #0f2a4a; font-weight: 600; }
  tbody td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: right; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { font-weight: 700; background: #e2e8f0; }
  @media print { .no-print { display: none; } }
  .toolbar { position: fixed; top: 8px; left: 8px; }
  .toolbar button { padding: 6px 12px; font-size: 13px; cursor: pointer; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <button onclick="window.print()">הדפסה / שמירה כ-PDF</button>
  </div>
  <h1>${esc(title)}</h1>
  <div class="meta">${new Date().toLocaleString("he-IL")} · ${rows.length} שורות</div>
  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));</script>
</body>
</html>`);
  w.document.close();
}

/** Convert an array of row objects (as passed to XLSX.json_to_sheet) into
 * (headers, rows) suitable for exportRowsAsPdf. */
export function objectsToTable(rows: Record<string, any>[]): {
  headers: string[];
  data: (string | number | null | undefined)[][];
} {
  if (!rows.length) return { headers: [], data: [] };
  const headers = Object.keys(rows[0]);
  const data = rows.map((r) => headers.map((h) => r[h]));
  return { headers, data };
}
