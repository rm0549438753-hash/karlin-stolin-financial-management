DROP TRIGGER IF EXISTS trg_log_transactions_actions ON public.transactions;
CREATE TRIGGER trg_log_transactions_actions
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

DROP TRIGGER IF EXISTS trg_log_accounts_actions ON public.accounts;
CREATE TRIGGER trg_log_accounts_actions
AFTER INSERT OR UPDATE OR DELETE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

DROP TRIGGER IF EXISTS trg_log_funds_actions ON public.funds;
CREATE TRIGGER trg_log_funds_actions
AFTER INSERT OR UPDATE OR DELETE ON public.funds
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

DROP TRIGGER IF EXISTS trg_log_expense_types_actions ON public.expense_types;
CREATE TRIGGER trg_log_expense_types_actions
AFTER INSERT OR UPDATE OR DELETE ON public.expense_types
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

DROP TRIGGER IF EXISTS trg_log_categories_actions ON public.categories;
CREATE TRIGGER trg_log_categories_actions
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();

DROP TRIGGER IF EXISTS trg_log_subcategories_actions ON public.subcategories;
CREATE TRIGGER trg_log_subcategories_actions
AFTER INSERT OR UPDATE OR DELETE ON public.subcategories
FOR EACH ROW EXECUTE FUNCTION public.log_action_history();