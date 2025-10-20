-- FASE 3: Criar cron job para sincronização automática do Google Calendar a cada 10 minutos
-- Isso garante que mudanças feitas no Google Calendar sejam refletidas no sistema

SELECT cron.schedule(
  'sync-all-google-calendars-10min',
  '*/10 * * * *', -- A cada 10 minutos
  $$
  SELECT
    net.http_post(
      url := 'https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/sync-all-google-calendars',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);