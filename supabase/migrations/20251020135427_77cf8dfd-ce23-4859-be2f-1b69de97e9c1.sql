-- FASE 1: Criar função RPC segura para verificar autenticação WhatsApp
CREATE OR REPLACE FUNCTION is_whatsapp_authenticated_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_count int;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM public.whatsapp_sessions
  WHERE user_id = p_user_id AND expires_at > now();

  RETURN session_count > 0;
END;
$$;

-- FASE 2: Corrigir transação do Roberto na organização errada
UPDATE transactions 
SET organization_id = '744f62d3-618e-4157-bb61-9ce951c769ce'
WHERE id = '77222e9c-9aea-41f3-9d5a-60eae6092d89';

-- FASE 3: Configurar cron jobs para lembretes
-- Primeiro, deletar jobs existentes se houver
SELECT cron.unschedule('send-commitment-reminders-5min');
SELECT cron.unschedule('send-daily-agenda-8am');

-- Criar job de lembretes a cada hora
SELECT cron.schedule(
  'send-commitment-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-commitment-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE5MTQzNiwiZXhwIjoyMDY3NzY3NDM2fQ.Kk_Ic6QXIi02-v3WfYQVbqe1HfTL1lz77Bqz0zCVBWA"}'::jsonb
  ) as request_id;
  $$
);

-- Criar job de agenda diária às 7h Brasília (10h UTC)
SELECT cron.schedule(
  'send-daily-agenda-7am-brt',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-daily-agenda',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjE5MTQzNiwiZXhwIjoyMDY3NzY3NDM2fQ.Kk_Ic6QXIi02-v3WfYQVbqe1HfTL1lz77Bqz0zCVBWA"}'::jsonb
  ) as request_id;
  $$
);