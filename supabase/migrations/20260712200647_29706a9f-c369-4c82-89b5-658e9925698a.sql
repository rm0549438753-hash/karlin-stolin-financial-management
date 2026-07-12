DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-backup') THEN
    PERFORM cron.unschedule('daily-backup');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-backup',
  '0 23 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', current_setting('app.settings.supabase_publishable_key', true)
    ),
    body := '{}'::jsonb
  );
  $cron$
);