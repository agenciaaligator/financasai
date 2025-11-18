-- Criar tabela de configurações WhatsApp para modo confirmação
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  require_confirmation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp settings"
  ON public.whatsapp_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp settings"
  ON public.whatsapp_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp settings"
  ON public.whatsapp_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.whatsapp_settings IS 'Configurações de comportamento WhatsApp por usuário';
COMMENT ON COLUMN public.whatsapp_settings.require_confirmation IS 'Se true, pede confirmação antes de criar transação via WhatsApp';