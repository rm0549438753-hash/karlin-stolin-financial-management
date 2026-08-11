-- 1) Transactions: readable only by users holding an explicit role
DROP POLICY IF EXISTS "auth read tx" ON public.transactions;
CREATE POLICY "roled users read tx"
ON public.transactions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'editor')
  OR public.has_role(auth.uid(), 'viewer')
);

-- 2) user_roles: only superadmin may grant/modify/remove admin or superadmin roles
DROP POLICY IF EXISTS "manage non-superadmin roles" ON public.user_roles;
DROP POLICY IF EXISTS "update non-superadmin roles" ON public.user_roles;
DROP POLICY IF EXISTS "delete non-superadmin roles" ON public.user_roles;

CREATE POLICY "insert roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR (role IN ('editor','viewer') AND public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR (role IN ('editor','viewer') AND public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  public.has_role(auth.uid(), 'superadmin')
  OR (role IN ('editor','viewer') AND public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin')
  OR (role IN ('editor','viewer') AND public.has_role(auth.uid(), 'admin'))
);