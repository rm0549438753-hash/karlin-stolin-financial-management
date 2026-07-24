
CREATE TABLE public.security_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'running',
  low_count int NOT NULL DEFAULT 0,
  moderate_count int NOT NULL DEFAULT 0,
  high_count int NOT NULL DEFAULT 0,
  critical_count int NOT NULL DEFAULT 0,
  total_dependencies int NOT NULL DEFAULT 0,
  report_json jsonb,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron'
);

GRANT SELECT, DELETE ON public.security_audit_runs TO authenticated;
GRANT ALL ON public.security_audit_runs TO service_role;

ALTER TABLE public.security_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read security audit runs"
  ON public.security_audit_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete security audit runs"
  ON public.security_audit_runs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
