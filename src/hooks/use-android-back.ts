import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Android hardware "back" button behaviour inside the Capacitor APK shell.
 *
 * Default Capacitor behaviour closes the app on every back press. Here the
 * button walks the in-app history instead, and only exits from the first
 * screen after a confirmation press. Has no effect in a normal browser.
 */
export function useAndroidBack() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    let lastExitPrompt = 0;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform?.()) return;
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          // A modal / sheet is open: let a back press close it first.
          const openOverlay = document.querySelector<HTMLElement>(
            '[data-state="open"][role="dialog"], [data-state="open"][data-radix-popper-content-wrapper]',
          );
          if (openOverlay) {
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            );
            return;
          }

          if (canGoBack && window.history.length > 1) {
            window.history.back();
            return;
          }

          const now = Date.now();
          if (now - lastExitPrompt < 2000) {
            void App.exitApp();
          } else {
            lastExitPrompt = now;
            toast("לחץ שוב על 'חזור' כדי לצאת מהאפליקציה");
          }
        });
        if (cancelled) handle.remove();
        else remove = () => handle.remove();
      } catch {
        /* plugin unavailable (web build) */
      }
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
}
