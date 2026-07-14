DO $$ BEGIN
  PERFORM cron.unschedule('daily-backup-resume');
EXCEPTION WHEN OTHERS THEN NULL; END $$;