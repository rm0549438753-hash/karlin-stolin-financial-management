export const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const ILS2 = ILS;
export const NUM = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(n: number | null | undefined, _decimals = true) {
  if (n == null || isNaN(n)) return "—";
  return ILS.format(n);
}

// Creating a date formatter is expensive; build it once and reuse it.
const DATE_FMT = new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "2-digit", day: "2-digit" });
export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return DATE_FMT.format(date);
}

export function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "short" }).format(d);
}
