import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Info, RefreshCw, Smartphone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { APP_VERSION, BUILD_TIME, formatHebrewDateTime, getNativeAppInfo, type NativeAppInfo } from "@/lib/build-info";

export const Route = createFileRoute("/_authenticated/about")({
  head: () => ({
    meta: [
      { title: "אודות המערכת — מרכז קארלין סטאלין" },
      { name: "description", content: "פרטי גרסה, תאריך בנייה ומידע על אפליקציית המובייל של ממשק הניהול הפיננסי." },
      { property: "og:title", content: "אודות המערכת — מרכז קארלין סטאלין" },
      { property: "og:description", content: "פרטי גרסה, תאריך בנייה ומידע על אפליקציית המובייל." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2.5 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function AboutPage() {
  const [native, setNative] = useState<NativeAppInfo | null>(null);
  const [loadedAt] = useState(() => new Date().toISOString());
  const navigate = useNavigate();

  useEffect(() => {
    getNativeAppInfo().then((info) => {
      setNative(info);
      if (!info.isNative) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const summary = [
    `גרסת ממשק: ${APP_VERSION}`,
    `תאריך בנייה: ${formatHebrewDateTime(BUILD_TIME)}`,
    native?.isNative ? `אפליקציה: ${native.version ?? "?"} (build ${native.build ?? "?"})` : "פועל בדפדפן",
  ].join(" | ");

  if (!native?.isNative) {
    return (
      <AppShell title="אודות המערכת">
        <div className="mx-auto w-full max-w-2xl p-6 text-center text-sm text-muted-foreground">
          מסך זה זמין רק באפליקציית האנדרואיד.
        </div>
      </AppShell>
    );
  }

  return (

    <AppShell title="אודות המערכת">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D4AF37]" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              ממשק הניהול הפיננסי
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="גרסת ממשק" value={APP_VERSION} mono />
            <Row label="תאריך ושעת בנייה" value={formatHebrewDateTime(BUILD_TIME)} />
            <Row label="נטען במכשיר בשעה" value={formatHebrewDateTime(loadedAt)} />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D4AF37]" />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4" />
              אפליקציית המובייל
            </CardTitle>
          </CardHeader>
          <CardContent>
            {native === null ? (
              <p className="py-3 text-sm text-muted-foreground">בודק…</p>
            ) : native.isNative ? (
              <>
                <div className="pb-2">
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">פועל באפליקציה המותקנת</Badge>
                </div>
                <Row label="שם האפליקציה" value={native.name ?? "—"} />
                <Row label="גרסת אפליקציה" value={native.version ?? "—"} mono />
                <Row label="מספר בנייה (build)" value={native.build ?? "—"} mono />
                <Row label="מערכת" value={native.platform ?? "—"} />
                <p className="pt-3 text-xs text-muted-foreground">
                  אם "תאריך ושעת בנייה" למעלה מעודכן — האפליקציה טוענת את הגרסה החדשה של הממשק. אם מספר הבנייה כאן לא
                  השתנה אחרי התקנת APK חדש, ההתקנה כנראה לא הצליחה.
                </p>
              </>
            ) : (
              <>
                <div className="pb-2">
                  <Badge variant="secondary">פועל בדפדפן</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  פרטי גרסת האפליקציה מוצגים רק כשפותחים את המסך הזה מתוך האפליקציה המותקנת בטלפון.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(summary);
              toast.success("פרטי הגרסה הועתקו");
            }}
          >
            <Copy className="ml-2 h-4 w-4" />
            העתק פרטי גרסה
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="ml-2 h-4 w-4" />
            רענן ובדוק שוב
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
