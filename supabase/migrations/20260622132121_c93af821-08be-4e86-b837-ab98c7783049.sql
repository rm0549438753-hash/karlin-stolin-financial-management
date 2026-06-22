ALTER TABLE public.funds ADD COLUMN IF NOT EXISTS is_vault BOOLEAN NOT NULL DEFAULT false;

UPDATE public.funds
SET is_vault = true
WHERE name NOT IN ('קופה כללי', 'קופה כללית', 'לא רלוונטי', 'בית הכנסת מרכז', 'בית הכנסת בנק', 'בית הכנסת בנק', 'תומכי עמותות', 'מתנות לאביונים', 'קמחא דפסחא', 'יין פסח פ"ו', 'פרי הארץ פועלים', 'בית אד"ש', 'ביהכנ"ס היכל רבנו יוחנן');