CREATE OR REPLACE FUNCTION public.get_cron_hook_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public, pg_temp
AS $$
  SELECT value FROM private.cron_secrets WHERE name = 'hook' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_hook_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_hook_secret() TO service_role;