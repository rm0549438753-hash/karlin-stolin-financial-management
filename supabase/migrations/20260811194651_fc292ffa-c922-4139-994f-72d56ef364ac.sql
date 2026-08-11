CREATE OR REPLACE FUNCTION public.dashboard_rows()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT
      t.id,
      CASE WHEN a.schema_type = 'checks' THEN t.value_date
           ELSE COALESCE(t.transaction_date, t.value_date) END AS transaction_date,
      t.value_date, t.amount, t.account_id, t.fund_id, t.expense_type_id,
      t.category_id, t.subcategory_id, t.description, t.note,
      t.credit, t.debit, t.payee, t.reference, t.association, t.balance, t.fee, t.channel
    FROM public.transactions t
    JOIN public.accounts a ON a.id = t.account_id
  ) x;
$function$;