import { supabase } from "@/integrations/supabase/client";

/**
 * Background queries (notification polling, alert banners, transaction lists)
 * kept firing after the Supabase refresh token expired. Without a JWT those
 * requests reach the database as an anonymous caller and fail with
 * "permission denied", leaving broken lists on screen.
 *
 * Every such query calls this guard first: when there is no live session we
 * skip the request entirely and send the user back to the login screen once.
 */
let redirecting = false;

export async function hasLiveSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return true;
  } catch {
    /* storage or network unavailable — treat as signed out */
  }
  if (typeof window !== "undefined" && !redirecting && !window.location.pathname.startsWith("/auth")) {
    redirecting = true;
    window.location.assign("/auth");
  }
  return false;
}
