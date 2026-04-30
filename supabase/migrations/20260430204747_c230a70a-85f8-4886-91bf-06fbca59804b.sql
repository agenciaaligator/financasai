CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-commitment-reminders-1h') THEN
    PERFORM cron.unschedule('send-commitment-reminders-1h');
  END IF;
END $$;

SELECT cron.schedule(
  'send-commitment-reminders-1h',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-commitment-reminders',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);