-- Configurar cron job para enviar agenda diária às 8h BRT (11:00 UTC)
SELECT cron.schedule(
  'send-daily-agenda-8am',
  '0 11 * * *', -- 11:00 UTC = 8:00 BRT
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-daily-agenda',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);