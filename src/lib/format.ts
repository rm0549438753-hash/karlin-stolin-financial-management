export const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
export const ILS2 = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const NUM = new Intl.NumberFormat("he-IL");

export function formatCurrency(n: number | null | undefined, decimals = false) {
  if (n == null || isNaN(n)) return "—";
  return decimals ? ILS2.format(n) : ILS.format(n);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "short" }).format(d);
}
