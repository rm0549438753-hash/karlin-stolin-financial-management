import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Account = { id: string; name: string; kind: string; is_active: boolean; sort_order: number };
export type Fund = { id: string; name: string; is_active: boolean };
export type ExpenseType = { id: string; name: string; is_active: boolean };
export type Category = { id: string; name: string; is_active: boolean };
export type Subcategory = { id: string; name: string; category_id: string | null; is_active: boolean };

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("sort_order");
      if (error) throw error;
      return data as Account[];
    },
  });
}
export function useFunds() {
  return useQuery({
    queryKey: ["funds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funds").select("*").order("name");
      if (error) throw error;
      return data as Fund[];
    },
  });
}
export function useExpenseTypes() {
  return useQuery({
    queryKey: ["expense_types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_types").select("*").order("name");
      if (error) throw error;
      return data as ExpenseType[];
    },
  });
}
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
}
export function useSubcategories() {
  return useQuery({
    queryKey: ["subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subcategories").select("*").order("name");
      if (error) throw error;
      return data as Subcategory[];
    },
  });
}
