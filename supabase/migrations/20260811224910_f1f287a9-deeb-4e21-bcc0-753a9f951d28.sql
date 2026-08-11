REVOKE ALL ON FUNCTION public.is_full_viewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_full_viewer(uuid) TO authenticated, service_role;