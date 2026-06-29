CREATE TABLE public.action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_history TO authenticated;
GRANT ALL ON public.action_history TO service_role;

ALTER TABLE public.action_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors can view action history"
ON public.action_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can create action history"
ON public.action_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Editors can mark action history undone"
ON public.action_history
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can delete action history"
ON public.action_history
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX action_history_created_at_idx ON public.action_history (created_at DESC);
CREATE INDEX action_history_table_record_idx ON public.action_history (table_name, record_id);

CREATE OR REPLACE FUNCTION public.log_action_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.action_history (table_name, record_id, action, old_data, new_data, actor_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'insert', NULL, to_jsonb(NEW), v_actor);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.action_history (table_name, record_id, action, old_data, new_data, actor_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), v_actor);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.action_history (table_name, record_id, action, old_data, new_data, actor_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD), NULL, v_actor);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_action_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_action_history() FROM anon;
REVOKE ALL ON FUNCTION public.log_action_history() FROM authenticated;

CREATE TRIGGER trg_log_transactions_actions
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

CREATE TRIGGER trg_log_accounts_actions
AFTER INSERT OR UPDATE OR DELETE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

CREATE TRIGGER trg_log_funds_actions
AFTER INSERT OR UPDATE OR DELETE ON public.funds
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

CREATE TRIGGER trg_log_expense_types_actions
AFTER INSERT OR UPDATE OR DELETE ON public.expense_types
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

CREATE TRIGGER trg_log_categories_actions
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

CREATE TRIGGER trg_log_subcategories_actions
AFTER INSERT OR UPDATE OR DELETE ON public.subcategories
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();