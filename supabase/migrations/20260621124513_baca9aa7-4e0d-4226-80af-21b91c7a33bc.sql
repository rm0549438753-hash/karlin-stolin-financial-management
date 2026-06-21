
-- Add schema_type and sheet_key to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS sheet_key text;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS schema_type text NOT NULL DEFAULT 'mercantile';
ALTER TABLE public.accounts ADD CONSTRAINT accounts_sheet_key_key UNIQUE (sheet_key);

-- Add extra columns to transactions for exact column representation per sheet
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS credit numeric(14,2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS debit numeric(14,2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS association text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS future_check boolean;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS operation_type text;

-- Clear old seeded data so we can replace from Excel
DELETE FROM public.transactions;
DELETE FROM public.subcategories;
DELETE FROM public.categories;
DELETE FROM public.expense_types;
DELETE FROM public.funds;
DELETE FROM public.accounts;

-- Insert 14 accounts from Excel
INSERT INTO public.accounts (sheet_key, name, kind, schema_type, sort_order) VALUES
  ('agudat_beit_olpana_mercantile', 'אגודת בית אולפנא - מרכנתיל', 'bank', 'mercantile', 1),
  ('agudat_beit_olpana_pagi',       'אגודת בית אולפנא - פאגי',     'bank', 'pagi',       2),
  ('agudat_yeshivat_karlin_mercantile', 'אגודת ישיבת קרלין - מרכנתיל', 'bank', 'mercantile', 3),
  ('agudat_yeshivat_karlin_pagi',       'אגודת ישיבת קרלין - פאגי',     'bank', 'pagi',       4),
  ('beit_haknesset_chatzer',         'בית הכנסת בחצר הקודש',        'bank', 'mercantile', 5),
  ('brina_yagilu',                   'ברינה יגילו',                   'bank', 'mercantile', 6),
  ('kollel_karlin',                  'כולל קרלין',                   'bank', 'mercantile', 7),
  ('midrashia_kav_lakav',            'מדרשייה קו לקו',               'bank', 'mercantile', 8),
  ('maalot_meron',                   'מעלות מירון',                  'bank', 'mercantile', 9),
  ('merkaz_mosdot_pagi',             'מרכז מוסדות - פאגי',           'bank', 'pagi',       10),
  ('merkaz_mosdot_karlin',           'מרכז מוסדות קרלין',            'bank', 'mercantile', 11),
  ('ezer_lenisuin',                  'עזר לנישואין',                  'bank', 'mercantile', 12),
  ('checks',                         'צ׳קים',                         'checks', 'checks', 13),
  ('cash',                           'מזומן',                         'cash',   'cash',   14);
