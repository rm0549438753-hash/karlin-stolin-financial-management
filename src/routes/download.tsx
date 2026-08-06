import { createFileRoute } from "@tanstack/react-router";
import { Download, Smartphone, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "הורדת האפליקציה | מרכז קארלין סטאלין" },
      { name: "description", content: "הורדת אפליקציית האנדרואיד של מערכת הניהול הפיננסי של מרכז קארלין סטאלין." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "הורדת האפליקציה | מרכז קארלין סטאלין" },
      { property: "og:description", content: "הורדת אפליקציית האנדרואיד של מערכת הניהול הפיננסי." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DownloadPage,
});

const APK_URL = "/api/public/apk";

function DownloadPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card text-card-foreground shadow-lg p-8 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Smartphone className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">מרכז קארלין סטאלין</h1>
          <p className="text-muted-foreground text-sm">
            אפליקציית אנדרואיד — התקנה ישירה במכשיר, ללא חנות אפליקציות.
          </p>
        </div>

        <a
          href={APK_URL}
          download
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground shadow transition hover:opacity-90"
        >
          <Download className="h-5 w-5" />
          הורדת האפליקציה
        </a>

        <ol className="text-right text-sm text-muted-foreground space-y-2 list-decimal pr-5">
          <li>לחץ על הכפתור — הקובץ יורד למכשיר.</li>
          <li>פתח את הקובץ שהורד (בהתראות או בתיקיית "הורדות").</li>
          <li>אשר "אפשר התקנה ממקור זה" אם אנדרואיד מבקש.</li>
          <li>לחץ "התקן" — האייקון יופיע במסך הבית.</li>
        </ol>

        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          האפליקציה מיועדת למשתמשים מורשים בלבד ודורשת התחברות.
        </p>
      </div>
    </div>
  );
}
