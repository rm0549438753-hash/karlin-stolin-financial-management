import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useUserRole() {
  const { user } = useAuthUser();
  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = data.map((r) => r.role as string);
      const isSuperAdmin = roles.includes("superadmin");
      const isAdmin = roles.includes("admin") || isSuperAdmin;
      const isEditor = roles.includes("editor") || isAdmin;
      const isViewer = roles.includes("viewer") || (!isAdmin && !isEditor);
      return {
        isSuperAdmin,
        isAdmin,
        isEditor,
        isViewer,
        canEdit: isEditor,
        roles,
      };
    },
  });
}
