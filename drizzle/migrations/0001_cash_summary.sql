CREATE OR REPLACE FUNCTION public.cash_summary(p_account uuid, p_month_start date)
RETURNS TABLE(balance numeric, month_in numeric, month_out numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount),0),
         COALESCE(SUM(CASE WHEN amount>0 AND transaction_date >= p_month_start AND transaction_date < (p_month_start + interval '1 month') THEN amount END),0),
         COALESCE(SUM(CASE WHEN amount<0 AND transaction_date >= p_month_start AND transaction_date < (p_month_start + interval '1 month') THEN -amount END),0)
  FROM public.transactions WHERE account_id = p_account
$$;
REVOKE ALL ON FUNCTION public.cash_summary(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_summary(uuid, date) TO authenticated;