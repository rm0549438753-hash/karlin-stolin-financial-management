ALTER TABLE public.email_automations DROP CONSTRAINT IF EXISTS email_automations_trigger_type_check;

UPDATE public.email_automations SET trigger_type = CASE trigger_type
  WHEN 'upcoming_checks' THEN 'checks_due'
  WHEN 'periodic_summary' THEN 'period_summary'
  WHEN 'uncategorized_threshold' THEN 'uncategorized'
  ELSE trigger_type END;

ALTER TABLE public.email_automations ADD CONSTRAINT email_automations_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY['checks_due','period_summary','negative_balance','low_cash','uncategorized','job_failure']));