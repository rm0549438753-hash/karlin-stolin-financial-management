
-- import_batches: track each xlsx import so we can undo
CREATE TABLE public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read import_batches" ON public.import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert import_batches" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin delete import_batches" ON public.import_batches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- link transactions to their import batch
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_import_batch ON public.transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_uncategorized ON public.transactions(account_id) WHERE fund_id IS NULL OR expense_type_id IS NULL;
