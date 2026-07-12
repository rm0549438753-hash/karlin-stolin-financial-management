
CREATE TABLE public.check_email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  recipients TEXT[] NOT NULL DEFAULT ARRAY['RM0549438753@gmail.com','5326725@gmail.com']::TEXT[],
  subject_template TEXT NOT NULL DEFAULT 'צ''קים לפירעון {{day_name}} {{date}} — {{count}} צ''קים, סה"כ {{total}}',
  body_intro TEXT NOT NULL DEFAULT 'שלום,
להלן פירוט הצ''קים הצפויים להיפרע {{day_name}} {{date}}:',
  body_outro TEXT NOT NULL DEFAULT 'בברכה,
{{org_name}}',
  include_association BOOLEAN NOT NULL DEFAULT TRUE,
  include_note BOOLEAN NOT NULL DEFAULT TRUE,
  send_when_empty BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_email_settings TO authenticated;
GRANT ALL ON public.check_email_settings TO service_role;

ALTER TABLE public.check_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view check email settings" ON public.check_email_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert check email settings" ON public.check_email_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update check email settings" ON public.check_email_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the singleton row
INSERT INTO public.check_email_settings (singleton) VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

-- Allow admins to delete history rows
CREATE POLICY "admins delete check email runs" ON public.check_email_runs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete backup_runs" ON public.backup_runs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
