
-- Keep the activity log lean: archive rows older than 6 months and anything
-- beyond the newest 25,000 entries. Archived rows stay available in
-- action_history_archive.
CREATE OR REPLACE FUNCTION public.archive_old_action_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE moved integer; extra integer;
BEGIN
  WITH old_rows AS (
    DELETE FROM public.action_history
    WHERE created_at < now() - interval '6 months'
    RETURNING *
  )
  INSERT INTO public.action_history_archive SELECT * FROM old_rows;
  GET DIAGNOSTICS moved = ROW_COUNT;

  WITH overflow AS (
    DELETE FROM public.action_history
    WHERE id IN (
      SELECT id FROM public.action_history
      ORDER BY created_at DESC
      OFFSET 25000
    )
    RETURNING *
  )
  INSERT INTO public.action_history_archive SELECT * FROM overflow;
  GET DIAGNOSTICS extra = ROW_COUNT;

  RETURN moved + extra;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_old_action_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_action_history() TO service_role, postgres;

SELECT cron.schedule('nightly-action-history-archive', '30 3 * * *',
  $cron$SELECT public.archive_old_action_history();$cron$);

SELECT public.archive_old_action_history();
