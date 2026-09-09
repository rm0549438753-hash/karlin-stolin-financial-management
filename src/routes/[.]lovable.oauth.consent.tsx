import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const LOGO_SRC = "/karlin-logo.svg";

type AuthDetails = {
  client?: { name?: string; client_name?: string; redirect_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: any }>;
};

function oauthApi(): OAuthApi | null {
  const api = (supabase.auth as any)?.oauth;
  return api ?? null;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/auth", search: { next: location.href } as any });
    }
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-sm text-destructive">אירעה שגיאה בתהליך ההרשאה.</p>
      <p className="text-xs text-muted-foreground mt-2">{String((error as any)?.message ?? error)}</p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-full max-w-[280px] rounded-2xl bg-white px-6 py-4 shadow-lg ring-2 ring-[#D4AF37]">
            <img src={LOGO_SRC} alt="מרכז קארלין סטאלין" className="w-full h-auto object-contain" />
          </div>
          <CardTitle className="text-xl">אישור חיבור</CardTitle>
          <CardDescription>מרכז קארלין סטאלין · ממשק ניהול פיננסי</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function scopeLabel(scope: string) {
  if (scope === "openid") return "זיהוי החשבון שלך";
  if (scope === "email") return "כתובת האימייל שלך";
  if (scope === "profile") return "פרטי הפרופיל הבסיסיים שלך";
  return `הרשאה נוספת: ${scope}`;
}

function ConsentPage() {
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const authorizationId = typeof window !== "undefined"
    ? new URL(window.location.href).searchParams.get("authorization_id")
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!cancelled) setEmail(sess.session?.user?.email ?? null);

      if (!authorizationId) {
        if (!cancelled) { setError("הבקשה אינה תקינה או שפג תוקפה."); setLoading(false); }
        return;
      }
      const api = oauthApi();
      if (!api) {
        if (!cancelled) { setError("שירות ההרשאות אינו זמין כרגע."); setLoading(false); }
        return;
      }
      const { data, error: err } = await api.getAuthorizationDetails(authorizationId);
      if (cancelled) return;
      if (err) { setError(err.message ?? "לא ניתן לטעון את פרטי הבקשה."); setLoading(false); return; }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (target && !data?.client) { window.location.href = target; return; }
      setDetails(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    if (!authorizationId) return;
    const api = oauthApi();
    if (!api) return;
    setBusy(true);
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (err) { setBusy(false); setError(err.message ?? "הפעולה נכשלה. נסה שוב."); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (target) window.location.href = target;
    else setBusy(false);
  }

  if (loading) return <Shell><p className="text-sm text-muted-foreground text-center">טוען…</p></Shell>;
  if (error) return <Shell><p className="text-sm text-destructive text-center">{error}</p></Shell>;

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "יישום חיצוני";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <Shell>
      <div className="space-y-4">
        <p className="text-base font-semibold text-center">
          לחבר את {clientName} למרכז קארלין סטאלין?
        </p>
        {email && (
          <p className="text-xs text-muted-foreground text-center">מחובר כעת כ־{email}</p>
        )}
        <p className="text-sm">
          {clientName} יוכל לפעול במערכת בשמך, בהתאם להרשאות של החשבון שלך.
        </p>
        {details?.client?.redirect_uri && (
          <p className="text-xs text-muted-foreground break-all" dir="ltr">{details.client.redirect_uri}</p>
        )}
        {scopes.length > 0 && (
          <ul className="text-sm list-disc pr-5 space-y-1">
            {scopes.map((s) => <li key={s}>{scopeLabel(s)}</li>)}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          החיבור אינו עוקף את ההרשאות והמדיניות של המערכת.
        </p>
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? "מאשר…" : "אישור החיבור"}
          </Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>
            ביטול
          </Button>
        </div>
      </div>
    </Shell>
  );
}
