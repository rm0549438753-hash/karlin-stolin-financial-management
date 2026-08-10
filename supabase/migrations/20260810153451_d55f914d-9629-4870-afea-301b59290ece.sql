CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  ip text,
  user_agent text,
  device_key text,
  is_new_device boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins can read login events" ON public.login_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX idx_login_events_user ON public.login_events(user_id, created_at DESC);

CREATE TABLE public.failed_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.failed_login_attempts TO authenticated;
GRANT ALL ON public.failed_login_attempts TO service_role;
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmins can read failed logins" ON public.failed_login_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));
CREATE INDEX idx_failed_login_email ON public.failed_login_attempts(lower(email), created_at DESC);

CREATE TABLE public.app_download_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  code_hash text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.app_download_settings TO authenticated;
GRANT ALL ON public.app_download_settings TO service_role;
ALTER TABLE public.app_download_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmins can read download settings" ON public.app_download_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER trg_app_download_settings_updated
  BEFORE UPDATE ON public.app_download_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.app_download_settings (singleton) VALUES (true);