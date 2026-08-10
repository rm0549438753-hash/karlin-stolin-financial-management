-- ============ 1. Performance indexes ============
CREATE INDEX IF NOT EXISTS idx_tx_value_date ON public.transactions (value_date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_expense_type ON public.transactions (expense_type_id);
CREATE INDEX IF NOT EXISTS idx_tx_subcategory ON public.transactions (subcategory_id);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tx_payee_trgm ON public.transactions USING gin (payee gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tx_description_trgm ON public.transactions USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tx_reference_trgm ON public.transactions USING gin (reference gin_trgm_ops);

-- ============ 2. Single-round-trip dashboard payload ============
CREATE OR REPLACE FUNCTION public.dashboard_rows()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT
      t.id,
      CASE WHEN a.schema_type = 'checks' THEN t.value_date
           ELSE COALESCE(t.transaction_date, t.value_date) END AS transaction_date,
      t.value_date, t.amount, t.account_id, t.fund_id, t.expense_type_id,
      t.category_id, t.subcategory_id, t.description, t.note,
      t.credit, t.debit, t.payee, t.reference, t.association, t.balance, t.fee, t.channel
    FROM public.transactions t
    JOIN public.accounts a ON a.id = t.account_id
    WHERE (CASE WHEN a.schema_type = 'checks' THEN t.value_date
                ELSE COALESCE(t.transaction_date, t.value_date) END) IS NOT NULL
  ) x;
$$;
GRANT EXECUTE ON FUNCTION public.dashboard_rows() TO authenticated;

-- ============ 3. Classification rules ============
CREATE TABLE public.classification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'suggest' CHECK (mode IN ('auto','suggest')),
  priority integer NOT NULL DEFAULT 100,
  match_field text NOT NULL DEFAULT 'payee' CHECK (match_field IN ('payee','description','reference','any')),
  match_text text,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  amount_min numeric,
  amount_max numeric,
  set_fund_id uuid REFERENCES public.funds(id) ON DELETE SET NULL,
  set_expense_type_id uuid REFERENCES public.expense_types(id) ON DELETE SET NULL,
  set_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  set_subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL,
  applied_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classification_rules TO authenticated;
GRANT ALL ON public.classification_rules TO service_role;
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read rules" ON public.classification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert rules" ON public.classification_rules FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update rules" ON public.classification_rules FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete rules" ON public.classification_rules FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_classification_rules_updated BEFORE UPDATE ON public.classification_rules FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.classification_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.classification_rules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, rule_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classification_suggestions TO authenticated;
GRANT ALL ON public.classification_suggestions TO service_role;
ALTER TABLE public.classification_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read suggestions" ON public.classification_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "editor write suggestions" ON public.classification_suggestions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "editor update suggestions" ON public.classification_suggestions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin')) WITH CHECK (true);
CREATE POLICY "admin delete suggestions" ON public.classification_suggestions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_suggestions_pending ON public.classification_suggestions (status, transaction_id);

-- ============ 4. In-app notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  read_at timestamptz,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read_at, created_at DESC);

-- ============ 5. Email automations ============
CREATE TABLE public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL CHECK (trigger_type IN ('upcoming_checks','periodic_summary','negative_balance','low_cash','uncategorized_threshold','job_failure')),
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','monthly')),
  send_hour integer NOT NULL DEFAULT 7 CHECK (send_hour BETWEEN 0 AND 23),
  recipients text[] NOT NULL DEFAULT '{}',
  threshold_value numeric,
  days_ahead integer,
  subject_template text NOT NULL DEFAULT '',
  body_intro text NOT NULL DEFAULT '',
  body_outro text NOT NULL DEFAULT '',
  send_when_empty boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_automations TO authenticated;
GRANT ALL ON public.email_automations TO service_role;
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read automations" ON public.email_automations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin insert automations" ON public.email_automations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update automations" ON public.email_automations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete automations" ON public.email_automations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_email_automations_updated BEFORE UPDATE ON public.email_automations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.email_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.email_automations(id) ON DELETE CASCADE,
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  summary text,
  error_message text,
  triggered_by text NOT NULL DEFAULT 'cron'
);
GRANT SELECT ON public.email_automation_runs TO authenticated;
GRANT ALL ON public.email_automation_runs TO service_role;
ALTER TABLE public.email_automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read automation runs" ON public.email_automation_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete automation runs" ON public.email_automation_runs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_automation_runs_ran_at ON public.email_automation_runs (ran_at DESC);

-- ============ 6. Action history archive ============
CREATE TABLE public.action_history_archive (LIKE public.action_history INCLUDING DEFAULTS);
ALTER TABLE public.action_history_archive ADD PRIMARY KEY (id);
GRANT SELECT ON public.action_history_archive TO authenticated;
GRANT ALL ON public.action_history_archive TO service_role;
ALTER TABLE public.action_history_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read archive" ON public.action_history_archive FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.archive_old_action_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE moved integer;
BEGIN
  WITH old_rows AS (
    DELETE FROM public.action_history
    WHERE created_at < now() - interval '12 months'
    RETURNING *
  )
  INSERT INTO public.action_history_archive SELECT * FROM old_rows;
  GET DIAGNOSTICS moved = ROW_COUNT;
  RETURN moved;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_old_action_history() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_action_history() TO service_role;