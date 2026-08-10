DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;

CREATE POLICY "manage non-superadmin roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  (role <> 'superadmin'::app_role AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);

CREATE POLICY "update non-superadmin roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (
  (role <> 'superadmin'::app_role AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
)
WITH CHECK (
  (role <> 'superadmin'::app_role AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);

CREATE POLICY "delete non-superadmin roles" ON public.user_roles
FOR DELETE TO authenticated
USING (
  (role <> 'superadmin'::app_role AND public.has_role(auth.uid(), 'admin'::app_role))
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);

CREATE POLICY "users insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);