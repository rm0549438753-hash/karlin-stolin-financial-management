DROP POLICY IF EXISTS "roled users read tx" ON public.transactions;

CREATE POLICY "roled users read tx"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'superadmin'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'editor'::public.app_role)
  OR public.has_role(auth.uid(), 'viewer'::public.app_role)
  OR public.is_full_viewer(auth.uid())
);