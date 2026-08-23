REVOKE ALL ON FUNCTION public.archive_old_action_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_action_history() TO service_role;