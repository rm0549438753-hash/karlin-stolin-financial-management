import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { checkLoginLockout, reportFailedLogin, logLoginEvent, checkIpBlocked } from "@/lib/security.functions";
import { getDeviceKey } from "@/lib/device-key";

const LOGO_SRC = "/karlin-logo.svg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const ipBlock = await checkIpBlocked().catch(() => null);
      if (ipBlock?.blocked) {
        setLoading(false);
        return toast.error("הגישה מכתובת זו חסומה. יש לפנות למנהל המערכת.");
      }
      const lock = await checkLoginLockout({ data: { email: email.trim() } });
      if (lock.locked) {
        setLoading(false);
        return toast.error(`החשבון ננעל זמנית עקב ניסיונות התחברות כושלים. נסה שוב בעוד ${lock.windowMinutes} דקות.`);
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const res = await reportFailedLogin({ data: { email: email.trim() } }).catch(() => null);
        setLoading(false);
        if (res?.locked) return toast.error("החשבון ננעל זמנית ל-15 דקות עקב 5 ניסיונות כושלים.");
        const left = res ? ` (נותרו ${res.remaining} ניסיונות)` : "";
        return toast.error("שגיאת התחברות: " + error.message + left);
      }

      await logLoginEvent({ data: { deviceKey: getDeviceKey() } }).catch(() => null);
      setLoading(false);
      toast.success("התחברת בהצלחה");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message ?? "שגיאת התחברות");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <img src={LOGO_SRC} alt="מרכז קארלין סטאלין" className="mx-auto w-full max-w-[300px] h-auto object-contain" />
          <CardTitle className="text-2xl">מרכז קארלין סטאלין</CardTitle>
          <CardDescription>ממשק ניהול פיננסי</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="si-email">אימייל</Label>
              <Input id="si-email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="si-pw">סיסמה</Label>
              <Input id="si-pw" type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "מתחבר..." : "התחבר"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
