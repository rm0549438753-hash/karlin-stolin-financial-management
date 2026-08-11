import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Temporary read-only demo access.
 * A visitor who opens /guest?t=<token> is signed in as the "viewer" guest
 * account — no credentials typed. Revoke by deleting/changing GUEST_LINK_TOKEN
 * or by blocking the guest user.
 */
export const guestLogin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(8).max(128) }))
  .handler(async ({ data }) => {
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const expected = process.env["GUEST_LINK_TOKEN"];
    const email = process.env["GUEST_DEMO_EMAIL"];
    const password = process.env["GUEST_DEMO_PASSWORD"];
    if (!expected || !email || !password) throw new Error("Guest access is not configured");
    const suppliedHash = createHash("sha256").update(data.token, "utf8").digest();
    const expectedHash = createHash("sha256").update(expected, "utf8").digest();
    if (!timingSafeEqual(suppliedHash, expectedHash)) throw new Error("Invalid link");

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"]
      ?? process.env["SUPABASE_ANON_KEY"]
      ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) throw new Error("Guest sign-in service is not configured");
    const client = createClient(url, publishableKey, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data: signed, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !signed.session) throw new Error(error?.message ?? "Guest sign-in failed");

    return {
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    };
  });
