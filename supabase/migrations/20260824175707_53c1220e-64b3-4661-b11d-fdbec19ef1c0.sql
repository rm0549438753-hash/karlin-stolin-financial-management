CREATE OR REPLACE FUNCTION public.portability_schema()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'tables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', c.relname,
        'columns', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'not_null', a.attnotnull,
            'default', pg_get_expr(d.adbin, d.adrelid)
          ) ORDER BY a.attnum)
          FROM pg_attribute a
          LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        ),
        'constraints', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', con.conname,
            'definition', pg_get_constraintdef(con.oid)
          ) ORDER BY con.conname)
          FROM pg_constraint con WHERE con.conrelid = c.oid
        ),
        'indexes', (
          SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid)
          FROM pg_index i WHERE i.indrelid = c.oid
        ),
        'rls_enabled', c.relrowsecurity,
        'policies', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', pol.polname,
            'command', pol.polcmd,
            'using', pg_get_expr(pol.polqual, pol.polrelid),
            'with_check', pg_get_expr(pol.polwithcheck, pol.polrelid)
          ) ORDER BY pol.polname)
          FROM pg_policy pol WHERE pol.polrelid = c.oid
        )
      ) ORDER BY c.relname)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ), '[]'::jsonb),
    'functions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'definition', pg_get_functiondef(p.oid)
      ) ORDER BY p.proname)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f'
    ), '[]'::jsonb),
    'triggers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', t.tgname,
        'definition', pg_get_triggerdef(t.oid)
      ) ORDER BY t.tgname)
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ), '[]'::jsonb),
    'enums', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', tt.typname,
        'values', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
                   FROM pg_enum e WHERE e.enumtypid = tt.oid)
      ) ORDER BY tt.typname)
      FROM pg_type tt
      JOIN pg_namespace n ON n.oid = tt.typnamespace
      WHERE n.nspname = 'public' AND tt.typtype = 'e'
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.portability_schema() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.portability_schema() FROM anon;
GRANT EXECUTE ON FUNCTION public.portability_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portability_schema() TO service_role;