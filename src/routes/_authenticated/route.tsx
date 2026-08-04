import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the cached local session (and refreshes only when
    // expired) — getUser() hit the network on every single navigation.
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
