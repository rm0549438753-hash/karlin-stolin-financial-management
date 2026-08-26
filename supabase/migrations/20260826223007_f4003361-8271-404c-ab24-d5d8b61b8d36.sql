CREATE TABLE public.push_notification_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL DEFAULT 'checks_due',
  days_before integer NOT NULL DEFAULT 1,
  send_hour integer NOT NULL DEFAULT 7,
  send_minute integer NOT NULL DEFAULT 0,
  min_amount numeric,
  title_template text NOT NULL DEFAULT 'מחר: {count} צ''קים לפירעון',
  body_template text NOT NULL DEFAULT 'סה"כ {total}. מומלץ לוודא כיסוי בחשבון.',
  link text NOT NULL DEFAULT '/reports?tab=future-checks',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_notification_rules TO authenticated;
GRANT ALL ON public.push_notification_rules TO service_role;

ALTER TABLE public.push_notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_rules_select" ON public.push_notification_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "push_rules_insert" ON public.push_notification_rules
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "push_rules_update" ON public.push_notification_rules
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
CREATE POLICY "push_rules_delete" ON public.push_notification_rules
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_push_notification_rules_updated
  BEFORE UPDATE ON public.push_notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.push_notification_rules (name, trigger_type, days_before, send_hour, sort_order)
VALUES ('תזכורת צ''קים לפירעון', 'checks_due', 1, 7, 0);