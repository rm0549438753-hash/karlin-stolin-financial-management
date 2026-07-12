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
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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