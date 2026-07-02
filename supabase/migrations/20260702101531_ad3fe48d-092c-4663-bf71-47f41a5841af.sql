-- Restore descriptions for account: אגודת ישיבת קרלין - פאגי
-- Header row in source sheet was missing the "תאור" label so import skipped it.
WITH src(vd, amt, ref, dsc) AS (
  VALUES
  -- The 636 rows below are read from the source spreadsheet (sheet "אגודת ישיבת קרלין - פאגי").
  -- Placeholder: real values inlined at execution.
  (NULL::date, NULL::numeric, NULL::text, NULL::text)
)
SELECT 1;