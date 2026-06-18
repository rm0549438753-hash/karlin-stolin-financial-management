
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS operation_code TEXT,
  ADD COLUMN IF NOT EXISTS payee TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT;

INSERT INTO public.accounts (name, kind, is_active, sort_order)
VALUES
  ('מרכנתיל', 'mercantile', true, 1),
  ('פאגי',    'pagi',       true, 2),
  ('מזומן',   'cash',       true, 3),
  ('צ׳קים',   'checks',     true, 4)
ON CONFLICT DO NOTHING;
