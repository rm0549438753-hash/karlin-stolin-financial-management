
-- 1) Retroactively flip all positive check-account transactions to negative
UPDATE public.transactions t
SET amount = -ABS(t.amount),
    debit = ABS(t.amount),
    credit = NULL
FROM public.accounts a
WHERE t.account_id = a.id
  AND a.schema_type = 'checks'
  AND t.amount IS NOT NULL
  AND t.amount > 0;

-- 2) Trigger to enforce negative amounts for checks accounts on insert/update
CREATE OR REPLACE FUNCTION public.enforce_checks_negative()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  SELECT schema_type INTO s FROM public.accounts WHERE id = NEW.account_id;
  IF s = 'checks' AND NEW.amount IS NOT NULL AND NEW.amount > 0 THEN
    NEW.amount := -ABS(NEW.amount);
    NEW.debit := ABS(NEW.amount);
    NEW.credit := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_checks_negative ON public.transactions;
CREATE TRIGGER trg_enforce_checks_negative
BEFORE INSERT OR UPDATE OF amount, account_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_checks_negative();
