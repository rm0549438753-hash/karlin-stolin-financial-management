
CREATE TABLE public.sync_ignores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('account','insert','review')),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  ref_key text NOT NULL DEFAULT '',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(kind, account_id, ref_key)
);
GRANT SELECT, INSERT, DELETE ON public.sync_ignores TO authenticated;
GRANT ALL ON public.sync_ignores TO service_role;
ALTER TABLE public.sync_ignores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_ignores select" ON public.sync_ignores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "sync_ignores insert" ON public.sync_ignores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "sync_ignores delete" ON public.sync_ignores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
