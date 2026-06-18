// Per-account-kind column templates for the transactions view.
// kinds: mercantile | pagi | cash | checks (fallback = generic)

export type AccountKind = "mercantile" | "pagi" | "cash" | "checks" | string;

// Hardcoded list of common עמותות for the checks view.
// Admin will be able to edit this list later from settings.
export const PAYEES = [
  "בית אולפנא",
  "כולל קרלין",
  "אגו' ישיבת קרלין",
  "מוסדות קרלין",
  "ת\"ת קרלין",
];

export type ColumnKey =
  | "transaction_date"
  | "value_date"
  | "description"
  | "credit_debit" // single signed amount, badge color
  | "debit"
  | "credit"
  | "balance"
  | "reference"
  | "fee"
  | "channel"
  | "operation_code"
  | "fund"
  | "expense_type"
  | "category"
  | "subcategory"
  | "note"
  | "payee"
  | "payer_name"
  | "amount_signed"
  | "actions";

export type ColumnDef = { key: ColumnKey; label: string; align?: "right" | "left" | "center"; className?: string };

const COMMON_TAIL: ColumnDef[] = [
  { key: "fund", label: "קופה" },
  { key: "expense_type", label: "סוג" },
  { key: "category", label: "קטגוריה" },
  { key: "subcategory", label: "תת-קטגוריה" },
];

export function columnsForKind(kind: AccountKind): ColumnDef[] {
  switch (kind) {
    case "mercantile":
      return [
        { key: "transaction_date", label: "תאריך" },
        { key: "value_date", label: "יום ערך" },
        { key: "description", label: "תיאור התנועה" },
        { key: "credit_debit", label: "זכות / חוב", align: "left" },
        { key: "balance", label: "יתרה", align: "left" },
        { key: "reference", label: "אסמכתא" },
        { key: "fee", label: "עמלה", align: "left" },
        { key: "channel", label: "ערוץ ביצוע" },
        ...COMMON_TAIL,
        { key: "note", label: "הערות" },
        { key: "actions", label: "", align: "center", className: "w-20" },
      ];
    case "pagi":
      return [
        { key: "transaction_date", label: "תאריך" },
        { key: "value_date", label: "תאריך ערך" },
        { key: "description", label: "תיאור" },
        { key: "operation_code", label: "קוד פעולה" },
        { key: "reference", label: "אסמכתא" },
        { key: "debit", label: "חובה", align: "left" },
        { key: "credit", label: "זכות", align: "left" },
        { key: "balance", label: "יתרה", align: "left" },
        ...COMMON_TAIL,
        { key: "note", label: "הערה" },
        { key: "actions", label: "", align: "center", className: "w-20" },
      ];
    case "cash":
      return [
        { key: "transaction_date", label: "תאריך" },
        { key: "description", label: "פירוט" },
        { key: "debit", label: "סכום הוצאה", align: "left" },
        { key: "credit", label: "סכום הכנסה", align: "left" },
        ...COMMON_TAIL,
        { key: "note", label: "הערה" },
        { key: "actions", label: "", align: "center", className: "w-20" },
      ];
    case "checks":
      return [
        { key: "transaction_date", label: "תאריך" },
        { key: "payee", label: "עמותה" },
        { key: "amount_signed", label: "סכום", align: "left" },
        { key: "payer_name", label: "שם" },
        { key: "value_date", label: "תאריך ערך" },
        ...COMMON_TAIL,
        { key: "note", label: "הערה" },
        { key: "actions", label: "", align: "center", className: "w-20" },
      ];
    default:
      return [
        { key: "transaction_date", label: "תאריך" },
        { key: "description", label: "תיאור" },
        { key: "credit_debit", label: "סכום", align: "left" },
        ...COMMON_TAIL,
        { key: "actions", label: "", align: "center", className: "w-20" },
      ];
  }
}

// Which extra fields the new/edit dialog should expose per kind
export function dialogFieldsForKind(kind: AccountKind) {
  return {
    valueDate: kind === "mercantile" || kind === "pagi" || kind === "checks",
    reference: kind === "mercantile" || kind === "pagi",
    fee: kind === "mercantile",
    channel: kind === "mercantile",
    operationCode: kind === "pagi",
    balance: kind === "mercantile" || kind === "pagi",
    payee: kind === "checks",
    payerName: kind === "checks",
    note: kind === "pagi" || kind === "cash" || kind === "checks",
  };
}
