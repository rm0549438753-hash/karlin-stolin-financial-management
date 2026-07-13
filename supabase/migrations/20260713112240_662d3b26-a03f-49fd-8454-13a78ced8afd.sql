
SELECT cron.unschedule('daily-backup');
SELECT cron.unschedule('daily-backup-resume');

SELECT cron.schedule(
  'daily-backup',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-backup',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqcWFnbmZ5ZGZzYnJ3YXZhenVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzQ3NDMsImV4cCI6MjA5NzM1MDc0M30.EuNgwcJqGhlXUY_qT9BtwzUetItT3DdyH47ZdvRfTFQ"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

SELECT cron.schedule(
  'daily-backup-resume',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-backup',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqcWFnbmZ5ZGZzYnJ3YXZhenVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzQ3NDMsImV4cCI6MjA5NzM1MDc0M30.EuNgwcJqGhlXUY_qT9BtwzUetItT3DdyH47ZdvRfTFQ"}'::jsonb,
    body := '{"resumeOnly":true}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);
