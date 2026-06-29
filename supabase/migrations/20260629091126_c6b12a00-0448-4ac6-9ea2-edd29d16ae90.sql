CREATE OR REPLACE FUNCTION public.undo_action_history(p_history_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.action_history%ROWTYPE;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();

  IF v_actor IS NULL OR NOT (public.has_role(v_actor, 'admin') OR public.has_role(v_actor, 'editor')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_row
  FROM public.action_history
  WHERE id = p_history_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'history record not found';
  END IF;

  IF v_row.undone_at IS NOT NULL THEN
    RAISE EXCEPTION 'history record already undone';
  END IF;

  IF v_row.table_name NOT IN ('transactions','accounts','funds','expense_types','categories','subcategories') THEN
    RAISE EXCEPTION 'table is not undoable';
  END IF;

  IF v_row.action = 'insert' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', v_row.table_name) USING v_row.record_id;
  ELSIF v_row.action = 'delete' THEN
    IF v_row.old_data IS NULL THEN
      RAISE EXCEPTION 'missing old data';
    END IF;
    EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', v_row.table_name, v_row.table_name) USING v_row.old_data;
  ELSIF v_row.action = 'update' THEN
    IF v_row.old_data IS NULL THEN
      RAISE EXCEPTION 'missing old data';
    END IF;
    EXECUTE format('UPDATE public.%I AS t SET %s FROM jsonb_populate_record(NULL::public.%I, $1) AS x WHERE t.id = $2',
      v_row.table_name,
      (
        SELECT string_agg(format('%1$I = x.%1$I', attname), ', ')
        FROM pg_attribute
        WHERE attrelid = format('public.%I', v_row.table_name)::regclass
          AND attnum > 0
          AND NOT attisdropped
          AND attname <> 'id'
      ),
      v_row.table_name
    ) USING v_row.old_data, v_row.record_id;
  ELSE
    RAISE EXCEPTION 'unsupported action';
  END IF;

  UPDATE public.action_history
  SET undone_at = now(), undone_by = v_actor
  WHERE id = p_history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_action_history(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_action_history(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.undo_action_history(uuid) TO authenticated;