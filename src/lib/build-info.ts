declare const __BUILD_TIME__: string | undefined;

/** Marketing/app version of the web interface. Bump when shipping a notable change. */
export const APP_VERSION = "1.4.0";

/** ISO timestamp stamped into the bundle at build time (see vite.config.ts). */
export const BUILD_TIME: string =
  typeof __BUILD_TIME__ !== "undefined" && __BUILD_TIME__ ? __BUILD_TIME__ : new Date().toISOString();

export function formatHebrewDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

export type NativeAppInfo = {
  isNative: boolean;
  name?: string;
  version?: string;
  build?: string;
  platform?: string;
};

/** Reads the installed APK's version/build when running inside the mobile app. */
export async function getNativeAppInfo(): Promise<NativeAppInfo> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return { isNative: false };
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return {
      isNative: true,
      name: info.name,
      version: info.version,
      build: info.build,
      platform: Capacitor.getPlatform(),
    };
  } catch {
    return { isNative: false };
  }
}

/** True only when running inside the installed Android/iOS app (Capacitor shell). */
export function isNativeAppSync(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}
