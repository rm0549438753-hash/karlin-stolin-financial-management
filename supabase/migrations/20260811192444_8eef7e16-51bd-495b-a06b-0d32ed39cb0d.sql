ALTER TABLE public.email_automations
  ADD COLUMN IF NOT EXISTS button_text text,
  ADD COLUMN IF NOT EXISTS button_url text,
  ADD COLUMN IF NOT EXISTS include_association boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_note boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_builtin boolean NOT NULL DEFAULT false;

INSERT INTO public.email_automations (
  name, is_active, trigger_type, frequency, send_hour, recipients,
  days_ahead, subject_template, body_intro, body_outro, send_when_empty,
  include_association, include_note, is_builtin
)
SELECT
  'מייל יומי · צ''קים שיוצאים מחר',
  true, 'checks_due', 'daily', 7, s.recipients,
  1, s.subject_template, s.body_intro, s.body_outro, s.send_when_empty,
  s.include_association, s.include_note, true
FROM public.check_email_settings s
WHERE NOT EXISTS (SELECT 1 FROM public.email_automations a WHERE a.is_builtin = true);