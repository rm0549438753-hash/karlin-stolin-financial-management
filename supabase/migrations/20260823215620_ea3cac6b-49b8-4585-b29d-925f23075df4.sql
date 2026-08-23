
-- 1. Compact, dictionary-encoded dashboard payload (same data, much smaller)
CREATE OR REPLACE FUNCTION public.dashboard_rows_compact()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH d AS (
  SELECT
    (SELECT COALESCE(array_agg(id ORDER BY id), '{}') FROM public.accounts) AS acc,
    (SELECT COALESCE(array_agg(id ORDER BY id), '{}') FROM public.funds) AS fund,
    (SELECT COALESCE(array_agg(id ORDER BY id), '{}') FROM public.expense_types) AS et,
    (SELECT COALESCE(array_agg(id ORDER BY id), '{}') FROM public.categories) AS cat,
    (SELECT COALESCE(array_agg(id ORDER BY id), '{}') FROM public.subcategories) AS sub
),
base AS (
  SELECT jsonb_build_array(
    t.id,
    CASE WHEN a.schema_type = 'checks' THEN t.value_date
         ELSE COALESCE(t.transaction_date, t.value_date) END,
    t.value_date,
    t.amount,
    array_position(d.acc, t.account_id),
    array_position(d.fund, t.fund_id),
    array_position(d.et, t.expense_type_id),
    array_position(d.cat, t.category_id),
    array_position(d.sub, t.subcategory_id),
    t.description, t.note, t.credit, t.debit, t.payee,
    t.reference, t.association, t.balance, t.fee, t.channel
  ) AS r
  FROM public.transactions t
  JOIN public.accounts a ON a.id = t.account_id
  CROSS JOIN d
)
SELECT jsonb_build_object(
  'v', 2,
  'acc', (SELECT to_jsonb(acc) FROM d),
  'fund', (SELECT to_jsonb(fund) FROM d),
  'et', (SELECT to_jsonb(et) FROM d),
  'cat', (SELECT to_jsonb(cat) FROM d),
  'sub', (SELECT to_jsonb(sub) FROM d),
  'rows', COALESCE((SELECT jsonb_agg(r) FROM base), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.dashboard_rows_compact() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_rows_compact() TO authenticated;

-- 2. One-shot uncategorized / missing-date counters (replaces repeated full scans)
CREATE OR REPLACE FUNCTION public.tx_alert_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
SELECT jsonb_build_object(
  'by_account', COALESCE((
    SELECT jsonb_object_agg(account_id::text, c) FROM (
      SELECT account_id, count(*) AS c
      FROM public.transactions
      WHERE fund_id IS NULL AND expense_type_id IS NULL
      GROUP BY account_id
    ) s
  ), '{}'::jsonb),
  'uncategorized_total', (
    SELECT count(*) FROM public.transactions
    WHERE fund_id IS NULL AND expense_type_id IS NULL
  ),
  'no_date', (
    SELECT count(*) FROM public.transactions t
    JOIN public.accounts a ON a.id = t.account_id
    WHERE (a.schema_type = 'checks' AND t.value_date IS NULL)
       OR (a.schema_type <> 'checks' AND t.transaction_date IS NULL AND t.value_date IS NULL)
  )
);
$$;

REVOKE ALL ON FUNCTION public.tx_alert_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_alert_counts() TO authenticated;

-- 3. Supporting indexes
CREATE INDEX IF NOT EXISTS idx_tx_uncat_strict
  ON public.transactions (account_id)
  WHERE fund_id IS NULL AND expense_type_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tx_no_date
  ON public.transactions (account_id)
  WHERE transaction_date IS NULL AND value_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_tx_value_date_null
  ON public.transactions (account_id)
  WHERE value_date IS NULL;

-- 4. Archive action history older than 6 months (was 12)
CREATE OR REPLACE FUNCTION public.archive_old_action_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE moved integer;
BEGIN
  WITH old_rows AS (
    DELETE FROM public.action_history
    WHERE created_at < now() - interval '6 months'
    RETURNING *
  )
  INSERT INTO public.action_history_archive SELECT * FROM old_rows;
  GET DIAGNOSTICS moved = ROW_COUNT;
  RETURN moved;
END;
$$;

SELECT public.archive_old_action_history();
