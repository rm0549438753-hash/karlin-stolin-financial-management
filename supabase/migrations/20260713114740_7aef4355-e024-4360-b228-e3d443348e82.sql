CREATE TABLE public.fund_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  year integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fund_id, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_opening_balances TO authenticated;
GRANT ALL ON public.fund_opening_balances TO service_role;

ALTER TABLE public.fund_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fund_opening_balances_select_authenticated"
  ON public.fund_opening_balances FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "fund_opening_balances_insert_admin_editor"
  ON public.fund_opening_balances FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "fund_opening_balances_update_admin_editor"
  ON public.fund_opening_balances FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "fund_opening_balances_delete_admin_editor"
  ON public.fund_opening_balances FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TRIGGER trg_fund_opening_balances_updated_at
  BEFORE UPDATE ON public.fund_opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();