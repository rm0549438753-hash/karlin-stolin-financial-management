import { useCallback, useEffect, useState } from "react";

export type TxFilters = {
  searchDesc: string;
  searchRef: string;
  searchName: string;
  searchAmount: string;
  category: string[];
  subcategory: string[];
  fund: string[];
  expType: string[];
  from: string;
  to: string;
  dateSort: "asc" | "desc";
  onlyUncat: boolean;
};

export const EMPTY_FILTERS: TxFilters = {
  searchDesc: "", searchRef: "", searchName: "", searchAmount: "",
  category: [], subcategory: [], fund: [], expType: [], from: "", to: "",
  dateSort: "desc", onlyUncat: false,
};

const FILTERS_KEY = "tx-filters-v1";
const VIEWS_KEY = "tx-saved-views-v1";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Loads the last-used filters for a given account from localStorage. */
export function loadFilters(accountId: string): TxFilters | null {
  const all = readJSON<Record<string, TxFilters>>(FILTERS_KEY, {});
  return all[accountId] ?? null;
}

/** Persists the current filters for a given account to localStorage. */
export function saveFilters(accountId: string, filters: TxFilters) {
  const all = readJSON<Record<string, TxFilters>>(FILTERS_KEY, {});
  all[accountId] = filters;
  try { localStorage.setItem(FILTERS_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

export type SavedView = { id: string; name: string; accountId: string; filters: TxFilters };

/** Manage named, per-account "favorite views" saved to localStorage. */
export function useSavedViews(accountId: string) {
  const [all, setAll] = useState<SavedView[]>(() => readJSON<SavedView[]>(VIEWS_KEY, []));

  useEffect(() => {
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  }, [all]);

  const views = all.filter((v) => v.accountId === accountId);

  const save = useCallback((name: string, filters: TxFilters) => {
    setAll((prev) => [...prev, { id: crypto.randomUUID(), name, accountId, filters }]);
  }, [accountId]);

  const remove = useCallback((id: string) => {
    setAll((prev) => prev.filter((v) => v.id !== id));
  }, []);

  return { views, save, remove };
}
