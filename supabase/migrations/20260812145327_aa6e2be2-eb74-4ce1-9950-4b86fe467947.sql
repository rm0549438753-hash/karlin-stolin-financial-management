REVOKE EXECUTE ON FUNCTION public.dashboard_rows() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.undo_action_history(uuid) FROM anon;