
CREATE OR REPLACE FUNCTION public.security_config_findings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  res jsonb := '[]'::jsonb;
  r record;
BEGIN
  -- tables without RLS
  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    res := res || jsonb_build_object(
      'id', 'rls_disabled:' || r.t, 'severity', 'critical', 'auto_fixable', true,
      'title', 'טבלה ללא הגנת שורות (RLS)',
      'detail', 'הטבלה ' || r.t || ' חשופה לקריאה/כתיבה ללא מדיניות הרשאות.',
      'remediation', 'הפעלת RLS על הטבלה');
  END LOOP;

  -- RLS enabled but no policies
  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
  LOOP
    res := res || jsonb_build_object(
      'id', 'no_policies:' || r.t, 'severity', 'moderate', 'auto_fixable', false,
      'title', 'טבלה ללא מדיניות גישה',
      'detail', 'הטבלה ' || r.t || ' עם RLS פעיל אך ללא מדיניות — אף אחד לא יכול לגשת אליה.',
      'remediation', 'הגדרת מדיניות גישה מתאימה');
  END LOOP;

  -- functions executable by anon
  FOR r IN
    SELECT p.proname AS f
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    res := res || jsonb_build_object(
      'id', 'anon_execute:' || r.f, 'severity', 'high', 'auto_fixable', true,
      'title', 'פונקציה רגישה פתוחה למשתמש אנונימי',
      'detail', 'הפונקציה ' || r.f || ' רצה בהרשאות מוגברות וניתנת להפעלה ללא התחברות.',
      'remediation', 'ביטול הרשאת הפעלה למשתמש אנונימי');
  END LOOP;

  -- functions without fixed search_path
  FOR r IN
    SELECT p.proname AS f
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%')
  LOOP
    res := res || jsonb_build_object(
      'id', 'search_path:' || r.f, 'severity', 'low', 'auto_fixable', true,
      'title', 'פונקציה ללא נתיב חיפוש קבוע',
      'detail', 'הפונקציה ' || r.f || ' עלולה להיות פגיעה להחלפת אובייקטים.',
      'remediation', 'קיבוע search_path לפונקציה');
  END LOOP;

  -- tables readable by anon
  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND has_table_privilege('anon', c.oid, 'SELECT')
  LOOP
    res := res || jsonb_build_object(
      'id', 'anon_read:' || r.t, 'severity', 'high', 'auto_fixable', true,
      'title', 'טבלה פתוחה לקריאה ללא התחברות',
      'detail', 'הטבלה ' || r.t || ' מעניקה הרשאת קריאה למשתמש אנונימי.',
      'remediation', 'ביטול הרשאת קריאה למשתמש אנונימי');
  END LOOP;

  RETURN res;
END;
$$;

REVOKE ALL ON FUNCTION public.security_config_findings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_config_findings() TO service_role;

CREATE OR REPLACE FUNCTION public.security_config_autofix()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  applied jsonb := '[]'::jsonb;
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.t);
    applied := applied || to_jsonb('הופעלה הגנת שורות על ' || r.t);
  END LOOP;

  FOR r IN
    SELECT c.relname AS t
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND has_table_privilege('anon', c.oid, 'SELECT')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.t);
    applied := applied || to_jsonb('בוטלה גישה אנונימית לטבלה ' || r.t);
  END LOOP;

  FOR r IN
    SELECT p.oid, p.proname AS f, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.f, r.args);
    applied := applied || to_jsonb('בוטלה הפעלה אנונימית לפונקציה ' || r.f);
  END LOOP;

  FOR r IN
    SELECT p.oid, p.proname AS f, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', r.f, r.args);
    applied := applied || to_jsonb('קובע נתיב חיפוש לפונקציה ' || r.f);
  END LOOP;

  RETURN applied;
END;
$$;

REVOKE ALL ON FUNCTION public.security_config_autofix() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_config_autofix() TO service_role;
