
CREATE TABLE public.check_email_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  for_date date NOT NULL,
  status text NOT NULL,
  check_count int NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron'
);
GRANT SELECT ON public.check_email_runs TO authenticated;
GRANT ALL ON public.check_email_runs TO service_role;
ALTER TABLE public.check_email_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins can view check email runs" ON public.check_email_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX check_email_runs_ran_at_idx ON public.check_email_runs (ran_at DESC);
