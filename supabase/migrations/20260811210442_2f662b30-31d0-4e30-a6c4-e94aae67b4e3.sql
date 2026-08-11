CREATE TABLE public.security_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE ON public.security_memory TO authenticated;
GRANT ALL ON public.security_memory TO service_role;

ALTER TABLE public.security_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read security memory" ON public.security_memory
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "admins insert security memory" ON public.security_memory
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "admins update security memory" ON public.security_memory
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_security_memory_updated
  BEFORE UPDATE ON public.security_memory
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.security_accepted_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_key text NOT NULL UNIQUE,
  title text NOT NULL,
  reason text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'low',
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_accepted_findings TO authenticated;
GRANT ALL ON public.security_accepted_findings TO service_role;

ALTER TABLE public.security_accepted_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read accepted findings" ON public.security_accepted_findings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "admins insert accepted findings" ON public.security_accepted_findings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "admins update accepted findings" ON public.security_accepted_findings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "admins delete accepted findings" ON public.security_accepted_findings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE TRIGGER trg_security_accepted_findings_updated
  BEFORE UPDATE ON public.security_accepted_findings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.security_memory (content) VALUES (
'# זיכרון אבטחה

מערכת ניהול פיננסי פרטית של מרכז קארלין סטולין. אין הרשמה עצמית — משתמשים נוצרים על ידי מנהל בלבד. כל הטבלאות מוגנות בהגנת שורות (RLS) וללא גישה אנונימית.

## מה אסור שיקרה
- משתמש בהרשאת צפייה לא ישנה תנועות, ייבא נתונים או ישנה הגדרות.
- משתמש רגיל לא יקבל הרשאת מנהל או מנהל-על בעצמו.
- אין גישה אנונימית (anon) לאף טבלה או פונקציה.
- מפתחות שירות וסודות לא נחשפים לצד הלקוח.

## סיכונים מאושרים
- ארכיון היסטוריית הפעילות ויומני השליחה הם לקריאה בלבד ונכתבים רק על ידי תהליכי מערכת — זו התנהגות מכוונת.
');

INSERT INTO public.security_accepted_findings (finding_key, title, reason, severity) VALUES
  ('action_history_archive_no_write_policies', 'ארכיון היסטוריית פעילות ללא הרשאות כתיבה', 'מכוון: הארכיון בלתי ניתן לשינוי ונכתב רק על ידי תהליך התחזוקה של המערכת. מנהל יכול רק לצפות.', 'low'),
  ('check_email_runs_no_write_policies', 'יומן שליחת מייל צ׳קים ללא הרשאות כתיבה', 'מכוון: היומן נכתב רק על ידי האוטומציה המתוזמנת, כדי שלא ניתן יהיה לזייף או לשנות רשומות שליחה.', 'low'),
  ('actor_names_security_definer', 'פונקציית שמות משתמשים בהרשאות מוגברות', 'מכוון: הפונקציה מחזירה רק שם תצוגה עבור מזהי משתמשים קיימים, ומשמשת להצגת "מבצע" בהיסטוריית הפעילות.', 'low');