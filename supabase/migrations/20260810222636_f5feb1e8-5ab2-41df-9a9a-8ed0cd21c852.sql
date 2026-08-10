-- 1. New users must not be auto-granted edit rights.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE role_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO role_count FROM public.user_roles;
  IF role_count = 0 THEN
    -- Bootstrap: the very first account in an empty system owns it.
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Least privilege: everyone else starts read-only until an admin
    -- explicitly grants editor/admin through the users panel.
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

-- 2. action_history_archive had an admin SELECT policy but no table grants at
--    all, so admins could not read it and archival writes had no trusted path.
GRANT SELECT ON public.action_history_archive TO authenticated;
GRANT ALL ON public.action_history_archive TO service_role;

REVOKE EXECUTE ON FUNCTION public.archive_old_action_history() FROM PUBLIC, anon, authenticated;