REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.undo_action_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_action_history(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_action_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM PUBLIC;