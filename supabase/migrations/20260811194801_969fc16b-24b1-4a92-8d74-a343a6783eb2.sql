CREATE OR REPLACE FUNCTION public.actor_names(_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, COALESCE(NULLIF(p.full_name, ''), split_part(p.email, '@', 1))
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
$$;

REVOKE ALL ON FUNCTION public.actor_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actor_names(uuid[]) TO authenticated;