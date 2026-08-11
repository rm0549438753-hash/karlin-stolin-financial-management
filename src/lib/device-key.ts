const KEY = "ks_device_key";
const COOKIE = "ks_device_key";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  // One year, same-site: survives localStorage clearing in most cases.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Stable per-browser identifier used to detect logins from new devices.
 * Stored in both localStorage and a long-lived cookie so that clearing one
 * of them does not make a familiar browser look like a brand new device.
 */
export function getDeviceKey(): string {
  if (typeof window === "undefined") return "server";
  try {
    let v: string | null = null;
    try {
      v = localStorage.getItem(KEY);
    } catch {
      v = null;
    }
    if (!v) v = readCookie(COOKIE);
    if (!v) v = crypto.randomUUID();
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* private mode — cookie still carries it */
    }
    writeCookie(COOKIE, v);
    return v;
  } catch {
    return "unknown";
  }
}
