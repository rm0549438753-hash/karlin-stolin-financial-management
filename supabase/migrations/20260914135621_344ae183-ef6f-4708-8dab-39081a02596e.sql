-- Effective-date + dashboard-tab classification, evaluated in the database.
CREATE OR REPLACE VIEW public.dashboard_tx WITH (security_invoker = on) AS
SELECT
  t.id,
  t.account_id,
  t.fund_id,
  t.expense_type_id,
  t.category_id,
  t.subcategory_id,
  t.amount,
  t.credit,
  t.debit,
  t.description,
  t.note,
  t.payee,
  t.reference,
  t.association,
  CASE WHEN a.schema_type = 'checks' THEN t.value_date
       ELSE COALESCE(t.transaction_date, t.value_date) END AS eff_date,
  CASE WHEN et.name = 'בית הכנסת - בניה' THEN 'project'
       WHEN t.fund_id IS NOT NULL THEN 'vaults'
       ELSE 'institution' END AS tab
FROM public.transactions t
JOIN public.accounts a ON a.id = t.account_id
LEFT JOIN public.expense_types et ON et.id = t.expense_type_id
LEFT JOIN public.funds f ON f.id = t.fund_id
WHERE f.name IS NULL OR f.name <> 'לא רלוונטי';

GRANT SELECT ON public.dashboard_tx TO authenticated;
GRANT SELECT ON public.dashboard_tx TO service_role;

-- Pre-aggregated dashboard numbers: a few hundred summary rows instead of ~10k raw rows.
CREATE OR REPLACE FUNCTION public.dashboard_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH agg AS (
    SELECT
      tab,
      to_char(eff_date, 'YYYY-MM') AS m,
      expense_type_id,
      fund_id,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inc,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS exp,
      COUNT(*) AS cnt
    FROM public.dashboard_tx
    WHERE eff_date IS NOT NULL
    GROUP BY 1, 2, 3, 4
  )
  SELECT jsonb_build_object(
    'v', 1,
    'rows', COALESCE(jsonb_agg(jsonb_build_array(tab, m, expense_type_id, fund_id, inc, exp, cnt)), '[]'::jsonb)
  )
  FROM agg;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO service_role;

-- Rows for one drill-down slice only.
CREATE OR REPLACE FUNCTION public.dashboard_drill(
  p_tab text,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_kind text DEFAULT 'all',
  p_expense_type text DEFAULT NULL,
  p_fund uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  transaction_date date,
  amount numeric,
  account_id uuid,
  fund_id uuid,
  expense_type_id uuid,
  category_id uuid,
  subcategory_id uuid,
  description text,
  note text,
  credit numeric,
  debit numeric,
  payee text,
  reference text,
  association text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT d.id, d.eff_date, d.amount, d.account_id, d.fund_id, d.expense_type_id,
         d.category_id, d.subcategory_id, d.description, d.note, d.credit, d.debit,
         d.payee, d.reference, d.association
  FROM public.dashboard_tx d
  WHERE d.eff_date IS NOT NULL
    AND d.tab = p_tab
    AND (p_from IS NULL OR d.eff_date >= p_from)
    AND (p_to IS NULL OR d.eff_date <= p_to)
    AND (p_kind = 'all'
         OR (p_kind = 'income' AND d.amount > 0)
         OR (p_kind = 'expense' AND d.amount < 0))
    AND (p_expense_type IS NULL
         OR (p_expense_type = '__none__' AND d.expense_type_id IS NULL)
         OR (p_expense_type <> '__none__' AND d.expense_type_id = p_expense_type::uuid))
    AND (p_fund IS NULL OR d.fund_id = p_fund)
  ORDER BY d.eff_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_drill(text, date, date, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_drill(text, date, date, text, text, uuid) TO service_role;