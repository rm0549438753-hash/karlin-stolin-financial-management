-- Word-list matching options for classification rules.
-- match_text becomes a comma-separated list of terms; a rule matches when ANY term matches.
ALTER TABLE public.classification_rules
  ADD COLUMN IF NOT EXISTS match_whole_word boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS match_smart boolean NOT NULL DEFAULT false;

-- Existing rules were authored as free substring matches; keep their behaviour
-- byte-for-byte identical by opting them out of the new whole-word default.
UPDATE public.classification_rules SET match_whole_word = false;

COMMENT ON COLUMN public.classification_rules.match_whole_word IS
  'Match each term only as a standalone word, not as part of a longer word.';
COMMENT ON COLUMN public.classification_rules.match_smart IS
  'Also match Hebrew inflections of each term (עמלה / עמלת / עמלות / העמלה).';