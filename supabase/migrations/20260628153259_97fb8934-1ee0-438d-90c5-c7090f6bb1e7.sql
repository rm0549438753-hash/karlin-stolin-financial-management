
-- 1. profiles: restrict read to self or admin
DROP POLICY IF EXISTS "auth read profiles" ON public.profiles;
CREATE POLICY "users read own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2. user_roles: restrict read to self or admin
DROP POLICY IF EXISTS "auth read roles" ON public.user_roles;
CREATE POLICY "users read own role or admin reads all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3. import_batches: restrict insert to admin/editor
DROP POLICY IF EXISTS "authenticated insert import_batches" ON public.import_batches;
CREATE POLICY "editor or admin insert import_batches" ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));

-- 4. SECURITY DEFINER functions: lock down EXECUTE
-- handle_new_user runs only as an auth trigger; revoke from clients
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role is invoked by RLS policies under the querying role and must remain
-- callable by authenticated. Revoke from anon to limit exposure.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
