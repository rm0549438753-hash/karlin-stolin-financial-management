
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.cron_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.cron_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.cron_secrets TO service_role;

INSERT INTO private.cron_secrets(name, value)
VALUES ('hook', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

-- Unschedule old jobs (ignore errors if not present)
DO $$ BEGIN
  PERFORM cron.unschedule('daily-backup-to-drive');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('daily-backup');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('daily-upcoming-checks-email');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'daily-backup',
  '0 23 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-backup',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT value FROM private.cron_secrets WHERE name='hook')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cmd$
);

SELECT cron.schedule(
  'daily-upcoming-checks-email',
  '0 7 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://karlin-stolin-financial-management.lovable.app/api/public/hooks/daily-checks-email',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', (SELECT value FROM private.cron_secrets WHERE name='hook')
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
