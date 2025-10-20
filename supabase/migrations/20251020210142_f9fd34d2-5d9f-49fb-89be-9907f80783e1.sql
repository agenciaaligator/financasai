-- Criar job para enviar lembretes de compromissos a cada 5 minutos
select
  cron.schedule(
    'send-commitment-reminders-5min',
    '*/5 * * * *',
    $$
    select
      net.http_post(
        url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-commitment-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
        body:='{"trigger":"cron"}'::jsonb
      ) as request_id;
    $$
  );

-- Criar job para enviar resumo diário às 8h de São Paulo (11:00 UTC)
select
  cron.schedule(
    'send-daily-agenda-8am',
    '0 11 * * *',
    $$
    select
      net.http_post(
        url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-daily-agenda',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
        body:='{"trigger":"cron"}'::jsonb
      ) as request_id;
    $$
  );