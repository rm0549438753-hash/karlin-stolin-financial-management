DROP POLICY IF EXISTS "auth read subcategories" ON public.subcategories;
CREATE POLICY "auth read subcategories" ON public.subcategories FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'viewer'));

DROP POLICY IF EXISTS "auth read rules" ON public.classification_rules;
CREATE POLICY "auth read rules" ON public.classification_rules FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'viewer'));

DROP POLICY IF EXISTS "auth read expense_types" ON public.expense_types;
CREATE POLICY "auth read expense_types" ON public.expense_types FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'superadmin') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'viewer'));