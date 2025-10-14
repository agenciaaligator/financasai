-- ============================================
-- PARTE 1: Sistema de Lembretes Personalizáveis
-- ============================================

-- 1. Criar tabela de configurações de lembretes
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tempos padrão de lembrete (em minutos antes do compromisso)
  default_reminders JSONB DEFAULT '[
    {"time": 1440, "enabled": true},
    {"time": 60, "enabled": true}
  ]'::jsonb,
  
  -- Preferências de envio
  send_via_whatsapp BOOLEAN DEFAULT true,
  send_via_email BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

-- RLS para reminder_settings
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reminder settings"
ON public.reminder_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Criar configuração padrão para usuários existentes
INSERT INTO public.reminder_settings (user_id, default_reminders)
SELECT id, '[
  {"time": 1440, "enabled": true},
  {"time": 60, "enabled": true}
]'::jsonb
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2. Adicionar coluna de lembretes agendados na tabela commitments
ALTER TABLE public.commitments 
ADD COLUMN IF NOT EXISTS scheduled_reminders JSONB DEFAULT '[]'::jsonb;

-- Inicializar scheduled_reminders para compromissos futuros existentes
UPDATE public.commitments
SET scheduled_reminders = '[
  {"time_minutes": 1440, "sent": false, "sent_at": null},
  {"time_minutes": 60, "sent": false, "sent_at": null}
]'::jsonb
WHERE scheduled_at > now() 
  AND (scheduled_reminders IS NULL OR scheduled_reminders = '[]'::jsonb);