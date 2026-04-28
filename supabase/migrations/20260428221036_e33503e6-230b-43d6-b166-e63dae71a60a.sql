
SELECT cron.schedule(
  'renew-google-watches-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/renew-google-watches',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
