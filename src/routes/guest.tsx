import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { guestLogin } from "@/lib/guest.functions";

export const Route = createFileRoute("/guest")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "כניסת אורח · מרכז קארלין סטאלין" },
      { name: "description", content: "כניסת צפייה זמנית לממשק הניהול הפיננסי של מרכז קארלין סטאלין." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GuestPage,
});

function GuestPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = new URLSearchParams(window.location.search).get("t") ?? "";
      if (!token) return setError("קישור לא תקין");
      try {
        // Keep the auto-logout guard in __root from wiping the fresh session.
        try { sessionStorage.setItem("lovable-app-session-active", "1"); } catch { /* ignore */ }
        const res = await guestLogin({ data: { token } });
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (sessErr) throw sessErr;
        if (!cancelled) navigate({ to: "/dashboard", replace: true });
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "הקישור אינו בתוקף");
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="rounded-xl border bg-card text-card-foreground shadow p-8 text-center max-w-sm w-full">
        {error ? (
          <>
            <h1 className="text-lg font-bold mb-2">לא ניתן להיכנס</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold mb-2">מתחבר כאורח…</h1>
            <p className="text-sm text-muted-foreground">רק צפייה — ללא אפשרות עריכה</p>
          </>
        )}
      </div>
    </div>
  );
}
