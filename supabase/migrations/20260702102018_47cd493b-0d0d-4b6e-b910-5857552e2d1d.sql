-- Step 1: match on amount + reference (when reference is present)
WITH candidates AS (
  SELECT t.id, s.dsc,
    ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY s.dsc) AS rn
  FROM public.transactions t
  JOIN public._pagi_desc_import s
    ON t.amount = s.amt
   AND s.ref IS NOT NULL
   AND t.reference = s.ref
  WHERE t.account_id = '348e405f-b10c-4a6f-95ae-06e3adbe46ba'
    AND (t.description IS NULL OR t.description = '')
)
UPDATE public.transactions t
SET description = c.dsc
FROM candidates c
WHERE t.id = c.id AND c.rn = 1;

-- Step 2: for remaining, match on amount + date (transaction_date or value_date) where reference is null
WITH candidates AS (
  SELECT t.id, s.dsc,
    ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY s.dsc) AS rn
  FROM public.transactions t
  JOIN public._pagi_desc_import s
    ON t.amount = s.amt
   AND s.ref IS NULL
   AND (t.reference IS NULL)
   AND (t.transaction_date = s.vd OR t.value_date = s.vd)
  WHERE t.account_id = '348e405f-b10c-4a6f-95ae-06e3adbe46ba'
    AND (t.description IS NULL OR t.description = '')
)
UPDATE public.transactions t
SET description = c.dsc
FROM candidates c
WHERE t.id = c.id AND c.rn = 1;

DROP TABLE public._pagi_desc_import;