
-- 1. Adicionar campos novos em calendar_connections
ALTER TABLE public.calendar_connections
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS webhook_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_resource_id TEXT,
  ADD COLUMN IF NOT EXISTS webhook_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_reauth BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_token TEXT;

-- 2. Criar tabela de tokens mágicos para conexão via WhatsApp
CREATE TABLE IF NOT EXISTS public.calendar_connection_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.calendar_connection_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages calendar tokens" ON public.calendar_connection_tokens;
CREATE POLICY "Service role manages calendar tokens"
ON public.calendar_connection_tokens
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own calendar tokens" ON public.calendar_connection_tokens;
CREATE POLICY "Users can view own calendar tokens"
ON public.calendar_connection_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_tokens_token ON public.calendar_connection_tokens(token);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_user ON public.calendar_connection_tokens(user_id);

-- 3. Limpar crons antigos (se existirem)
DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'send-commitment-reminders-5min',
    'send-daily-agenda-8am',
    'sync-all-google-calendars-10min'
  ]
  LOOP
    BEGIN
      PERFORM cron.unschedule(job_name);
    EXCEPTION WHEN OTHERS THEN
      -- Ignora se o cron não existe
      NULL;
    END;
  END LOOP;
END $$;
