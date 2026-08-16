import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hasLiveSession } from "@/lib/session-guard";

export type Account = { id: string; name: string; kind: string; is_active: boolean; sort_order: number; sheet_key: string | null; schema_type: "mercantile" | "pagi" | "checks" | "cash" };
export type Fund = { id: string; name: string; is_active: boolean; is_vault?: boolean };
export type ExpenseType = { id: string; name: string; is_active: boolean };
export type Category = { id: string; name: string; is_active: boolean };
export type Subcategory = { id: string; name: string; category_id: string | null; is_active: boolean };

// Lookups change rarely — cache aggressively across pages
const LOOKUP_OPTS = {
  staleTime: 10 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
} as const;

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      if (!(await hasLiveSession())) return [] as Account[];
      const { data, error } = await supabase.from("accounts").select("*").order("sort_order");
      if (error) throw error;
      return data as Account[];
    },
    ...LOOKUP_OPTS,
  });
}
export function useFunds() {
  return useQuery({
    queryKey: ["funds"],
    queryFn: async () => {
      if (!(await hasLiveSession())) return [] as Fund[];
      const { data, error } = await supabase.from("funds").select("*").order("name");
      if (error) throw error;
      return data as Fund[];
    },
    ...LOOKUP_OPTS,
  });
}
export function useExpenseTypes() {
  return useQuery({
    queryKey: ["expense_types"],
    queryFn: async () => {
      if (!(await hasLiveSession())) return [] as ExpenseType[];
      const { data, error } = await supabase.from("expense_types").select("*").order("name");
      if (error) throw error;
      return data as ExpenseType[];
    },
    ...LOOKUP_OPTS,
  });
}
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!(await hasLiveSession())) return [] as Category[];
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
    ...LOOKUP_OPTS,
  });
}
export function useSubcategories() {
  return useQuery({
    queryKey: ["subcategories"],
    queryFn: async () => {
      if (!(await hasLiveSession())) return [] as Subcategory[];
      const { data, error } = await supabase.from("subcategories").select("*").order("name");
      if (error) throw error;
      return data as Subcategory[];
    },
    ...LOOKUP_OPTS,
  });
}
