-- Idioma preferido do usuario (hoje so existia no navegador, backend nao sabia)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT;

-- Evita reenviar o aviso de renovacao mais de uma vez para o mesmo ciclo
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS renewal_reminder_sent_for TIMESTAMPTZ;

-- Cron diario, 12:00 UTC (~09:00 BRT)
SELECT cron.schedule(
  'send-renewal-reminders-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-renewal-reminders',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
