-- Sprint 1 & 2: Lembretes Inteligentes + Google Calendar Integration

-- 1. Adicionar campos para múltiplos lembretes e informações de convênio
ALTER TABLE public.commitments 
  ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '{
    "week": false,
    "day": false, 
    "hours": false,
    "confirmed": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS insurance_name TEXT DEFAULT NULL;

-- Migrar dados existentes da coluna reminder_sent para o novo formato
UPDATE public.commitments 
SET reminders_sent = jsonb_build_object(
  'week', false,
  'day', COALESCE(reminder_sent, false),
  'hours', false,
  'confirmed', false
)
WHERE reminders_sent = '{
    "week": false,
    "day": false, 
    "hours": false,
    "confirmed": false
  }'::jsonb;

-- 2. Criar tabela para conexões de calendário
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'apple', 'notion')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  calendar_id TEXT,
  calendar_email TEXT,
  calendar_name TEXT,
  custom_name TEXT,
  is_active BOOLEAN DEFAULT true,
  sync_preferences JSONB DEFAULT '{
    "auto_sync": true,
    "sync_direction": "bidirectional",
    "notify_on_sync": false
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON public.calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_provider ON public.calendar_connections(provider);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_active ON public.calendar_connections(user_id, is_active) WHERE is_active = true;

-- Criar índice para commitments.reminders_sent
CREATE INDEX IF NOT EXISTS idx_commitments_reminders ON public.commitments USING gin(reminders_sent);

-- 3. Habilitar RLS na tabela calendar_connections
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- RLS: Usuários podem ver suas próprias conexões
CREATE POLICY "Users can view own calendar connections"
  ON public.calendar_connections FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: Usuários podem criar suas próprias conexões
CREATE POLICY "Users can create own calendar connections"
  ON public.calendar_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: Usuários podem atualizar suas próprias conexões
CREATE POLICY "Users can update own calendar connections"
  ON public.calendar_connections FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS: Usuários podem deletar suas próprias conexões
CREATE POLICY "Users can delete own calendar connections"
  ON public.calendar_connections FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_calendar_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_calendar_connections_updated_at ON public.calendar_connections;
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calendar_connections_updated_at();