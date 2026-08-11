import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">העמוד לא נמצא</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          העמוד שחיפשתם לא קיים או הוסר.
        </p>
        <a href="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          חזרה לעמוד הבית
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">קרתה תקלה</h1>
        <p className="mt-2 text-sm text-muted-foreground">משהו השתבש. נסו לרענן.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >נסה שוב</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent">דף הבית</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
      { title: "מוסדות קרלין - ניהול כספים" },
      { name: "description", content: "מערכת לניהול פיננסי של מוסדות קרלין" },
      { property: "og:title", content: "מוסדות קרלין - ניהול כספים" },
      { name: "twitter:title", content: "מוסדות קרלין - ניהול כספים" },
      { property: "og:description", content: "מערכת לניהול פיננסי של מוסדות קרלין" },
      { name: "twitter:description", content: "מערכת לניהול פיננסי של מוסדות קרלין" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dcc124ca-e44c-41e6-a282-a6e77041fe59/id-preview-14941c9f--fc9530c9-4ee2-43bc-9557-a23bae98cfae.lovable.app-1782660855433.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dcc124ca-e44c-41e6-a282-a6e77041fe59/id-preview-14941c9f--fc9530c9-4ee2-43bc-9557-a23bae98cfae.lovable.app-1782660855433.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#0d3b66" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "קארלין סטאלין" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    // Theme: dark by default unless the user explicitly chose light.
    try {
      const saved = localStorage.getItem("theme");
      document.documentElement.classList.toggle("dark", saved ? saved === "dark" : true);
    } catch { /* storage unavailable */ }

    // Auto-logout on browser close: sessionStorage is cleared when the browser
    // (not just the tab) fully closes. Reloads / in-tab navigation keep it.

    try {
      const SESSION_FLAG = "lovable-app-session-active";
      if (!sessionStorage.getItem(SESSION_FLAG)) {
        // Fresh browser session — purge any persisted supabase auth tokens.
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
            localStorage.removeItem(k);
          }
        }
        void supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
      sessionStorage.setItem(SESSION_FLAG, "1");
    } catch { /* storage unavailable */ }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [queryClient, router]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
