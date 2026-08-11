CREATE TABLE public.classification_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.classification_rules(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  changed jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous jsonb NOT NULL DEFAULT '{}'::jsonb,
  reverted_at timestamptz,
  applied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_class_app_rule ON public.classification_applications(rule_id, created_at DESC);
CREATE INDEX idx_class_app_tx ON public.classification_applications(transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classification_applications TO authenticated;
GRANT ALL ON public.classification_applications TO service_role;

ALTER TABLE public.classification_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editors read classification applications"
ON public.classification_applications FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "editors insert classification applications"
ON public.classification_applications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "editors update classification applications"
ON public.classification_applications FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "admins delete classification applications"
ON public.classification_applications FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));