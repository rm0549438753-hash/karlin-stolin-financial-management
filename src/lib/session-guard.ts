import { supabase } from "@/integrations/supabase/client";

/**
 * Background queries (notification polling, alert banners, transaction lists)
 * kept firing after the Supabase refresh token expired. Without a JWT those
 * requests reach the database as an anonymous caller and fail with
 * "permission denied", leaving broken lists on screen.
 *
 * Every such query calls this guard first: when there is no live session we
 * skip the request entirely and send the user back to the login screen once.
 *
 * Performance: `getSession()` touches storage (and in the preview a brokered
 * async channel) on every call, and the app calls this guard before *each*
 * query — dozens of times on a single screen load. The positive answer is now
 * cached for a short window and invalidated whenever the auth state changes,
 * so a screen load performs one session read instead of dozens.
 */
let redirecting = false;
let cachedUntil = 0;
let inflight: Promise<boolean> | null = null;
const CACHE_MS = 30_000;

let subscribed = false;
function subscribeOnce() {
  if (subscribed || typeof window === "undefined") return;
  subscribed = true;
  supabase.auth.onAuthStateChange(() => {
    cachedUntil = 0;
    inflight = null;
  });
}

async function readSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      cachedUntil = Date.now() + CACHE_MS;
      return true;
    }
  } catch {
    /* storage or network unavailable — treat as signed out */
  }
  cachedUntil = 0;
  if (typeof window !== "undefined" && !redirecting && !window.location.pathname.startsWith("/auth")) {
    redirecting = true;
    window.location.assign("/auth");
  }
  return false;
}

export async function hasLiveSession(): Promise<boolean> {
  subscribeOnce();
  if (Date.now() < cachedUntil) return true;
  if (!inflight) {
    inflight = readSession().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
