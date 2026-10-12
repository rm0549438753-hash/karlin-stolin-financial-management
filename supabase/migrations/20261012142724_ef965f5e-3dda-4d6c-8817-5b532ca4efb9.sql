CREATE OR REPLACE FUNCTION public.has_any_app_role(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.has_role(_uid,'superadmin') OR public.has_role(_uid,'admin')
      OR public.has_role(_uid,'editor') OR public.has_role(_uid,'viewer')
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_app_role(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_any_app_role(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "push_rules_select" ON public.push_notification_rules;
CREATE POLICY "push_rules_select" ON public.push_notification_rules FOR SELECT TO authenticated USING (public.has_any_app_role(auth.uid()));
DROP POLICY IF EXISTS "auth read categories" ON public.categories;
CREATE POLICY "auth read categories" ON public.categories FOR SELECT TO authenticated USING (public.has_any_app_role(auth.uid()));
DROP POLICY IF EXISTS "auth read funds" ON public.funds;
CREATE POLICY "auth read funds" ON public.funds FOR SELECT TO authenticated USING (public.has_any_app_role(auth.uid()));
DROP POLICY IF EXISTS "authenticated read import_batches" ON public.import_batches;
CREATE POLICY "authenticated read import_batches" ON public.import_batches FOR SELECT TO authenticated USING (public.has_any_app_role(auth.uid()));
DROP POLICY IF EXISTS "fund_opening_balances_select_authenticated" ON public.fund_opening_balances;
CREATE POLICY "fund_opening_balances_select_authenticated" ON public.fund_opening_balances FOR SELECT TO authenticated USING (public.has_any_app_role(auth.uid()));
DROP POLICY IF EXISTS "auth read accounts" ON public.accounts;
CREATE POLICY "auth read accounts" ON public.accounts FOR SELECT TO authenticated USING (public.has_any_app_role(auth.uid()));
DROP POLICY IF EXISTS "auth read suggestions" ON public.classification_suggestions;
CREATE POLICY "auth read suggestions" ON public.classification_suggestions FOR SELECT TO authenticated USING (public.has_any_app_role(auth.uid()));
DROP POLICY IF EXISTS "editor update suggestions" ON public.classification_suggestions;
CREATE POLICY "editor update suggestions" ON public.classification_suggestions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'editor') OR public.has_role(auth.uid(),'admin'));

-- Users may edit their own profile, but never their own access flags.
CREATE OR REPLACE FUNCTION public.protect_profile_flags()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND (NEW.full_view IS DISTINCT FROM OLD.full_view OR NEW.blocked IS DISTINCT FROM OLD.blocked)
     AND NOT public.has_role(auth.uid(),'superadmin') THEN
    RAISE EXCEPTION 'not authorized to change access flags';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_profile_flags ON public.profiles;
CREATE TRIGGER trg_protect_profile_flags BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_flags();
CREATE OR REPLACE FUNCTION public.protect_profile_flags_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'superadmin') THEN
    NEW.full_view := false; NEW.blocked := false;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_profile_flags_ins ON public.profiles;
CREATE TRIGGER trg_protect_profile_flags_ins BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_flags_insert();