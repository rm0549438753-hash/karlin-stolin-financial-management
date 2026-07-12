DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-backup') THEN
    PERFORM cron.unschedule('daily-backup');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-backup-resume') THEN
    PERFORM cron.unschedule('daily-backup-resume');
  END IF;
END $$;

DROP EXTENSION IF EXISTS pg_net;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
REVOKE ALL ON ALL TABLES IN SCHEMA extensions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA extensions FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA extensions FROM PUBLIC;
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;

SELECT cron.schedule(
  'daily-backup',
  '0 23 * * *',
  $cron$
  SELECT extensions.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.settings.publishable_key', true)
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'daily-backup-resume',
  '* * * * *',
  $cron$
  SELECT extensions.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.settings.publishable_key', true)
    ),
    body := '{"resumeOnly":true}'::jsonb
  );
  $cron$
);