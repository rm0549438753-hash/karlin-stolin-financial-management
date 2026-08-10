import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const IDLE_MS = 30 * 60 * 1000; // 30 דקות

/** Signs the user out automatically after 30 minutes without activity. */
export function useIdleLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function signOut() {
      if (cancelled) return;
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.info("התנתקת אוטומטית לאחר 30 דקות ללא פעילות");
      navigate({ to: "/auth", replace: true });
    }

    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(signOut, IDLE_MS);
    }

    const events = ["mousedown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [navigate, queryClient]);
}
