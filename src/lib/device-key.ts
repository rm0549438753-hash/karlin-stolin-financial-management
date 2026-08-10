const KEY = "ks_device_key";

/** Stable per-browser identifier used to detect logins from new devices. */
export function getDeviceKey(): string {
  if (typeof window === "undefined") return "server";
  try {
    let v = localStorage.getItem(KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return "unknown";
  }
}
