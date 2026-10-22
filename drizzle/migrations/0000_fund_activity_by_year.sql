CREATE OR REPLACE FUNCTION public.fund_activity(p_year integer)
RETURNS TABLE(fund_id uuid, received numeric, returned numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT d.fund_id,
         COALESCE(SUM(CASE WHEN d.amount > 0 THEN d.amount END), 0) AS received,
         COALESCE(SUM(CASE WHEN d.amount < 0 THEN -d.amount END), 0) AS returned
  FROM public.dashboard_tx d
  WHERE d.fund_id IS NOT NULL
    AND d.eff_date >= make_date(p_year, 1, 1)
  GROUP BY d.fund_id
$$;
REVOKE ALL ON FUNCTION public.fund_activity(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fund_activity(integer) TO authenticated;