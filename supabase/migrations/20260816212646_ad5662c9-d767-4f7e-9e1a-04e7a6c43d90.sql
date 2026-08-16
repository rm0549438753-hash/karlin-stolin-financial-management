REVOKE EXECUTE ON FUNCTION public.dashboard_rows() FROM anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_rows() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_rows() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_rows() TO service_role;