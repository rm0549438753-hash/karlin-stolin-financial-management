ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS current_table text,
  ADD COLUMN IF NOT EXISTS processed_rows bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz NOT NULL DEFAULT now();

UPDATE public.backup_runs
SET status = 'failed',
    finished_at = now(),
    heartbeat_at = now(),
    error_message = COALESCE(error_message, 'הריצה הופסקה לפני השלמת הגיבוי. ניתן להפעיל גיבוי חדש.')
WHERE status IN ('running', 'processing')
  AND started_at < now() - interval '15 minutes';

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'daily-backup-resume';

SELECT cron.schedule(
  'daily-backup-resume',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-backup',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InJqcWFnbmZ5ZGZzYnJ3YXZhenVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzQ3NDMsImV4cCI6MjA5NzM1MDc0M30.EuNgwcJqGhlXUY_qT9BtwzUetItT3DdyH47ZdvRfTFQ"}'::jsonb,
    body := '{"resumeOnly": true}'::jsonb,
    timeout_milliseconds := 50000
  ) AS request_id;
  $cron$
);