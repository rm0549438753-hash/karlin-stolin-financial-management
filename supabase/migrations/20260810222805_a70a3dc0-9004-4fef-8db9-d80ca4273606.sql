-- The archive inherited broad default grants (anon could reach it, and any
-- authenticated user held INSERT/UPDATE/DELETE at the grant layer). RLS still
-- blocked those writes, but the grants themselves should be least-privilege.
REVOKE ALL ON public.action_history_archive FROM anon;
REVOKE ALL ON public.action_history_archive FROM authenticated;

-- Admin-only reads are enforced by the existing "admin read archive" policy.
GRANT SELECT ON public.action_history_archive TO authenticated;

-- Archival writes happen only through the trusted server-side maintenance path.
GRANT ALL ON public.action_history_archive TO service_role;