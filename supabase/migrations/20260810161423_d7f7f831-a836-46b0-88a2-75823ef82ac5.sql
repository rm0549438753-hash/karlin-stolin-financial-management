ALTER TABLE public.login_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'login',
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text;

CREATE INDEX IF NOT EXISTS idx_login_events_created_at ON public.login_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_login_created_at ON public.failed_login_attempts (created_at DESC);

ALTER TABLE public.app_download_settings
  ADD COLUMN IF NOT EXISTS code_cipher text;

CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.blocked_ips TO authenticated;
GRANT ALL ON public.blocked_ips TO service_role;

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin reads blocked ips" ON public.blocked_ips
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'::app_role));