-- FASE 1: Ativar plano Trial existente
UPDATE subscription_plans 
SET is_active = true 
WHERE name = 'trial';

-- FASE 2: Criar tabela para códigos de validação WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_validation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),
  used BOOLEAN DEFAULT FALSE
);

-- Index para performance
CREATE INDEX idx_whatsapp_validation_user ON whatsapp_validation_codes(user_id);
CREATE INDEX idx_whatsapp_validation_code ON whatsapp_validation_codes(code, used);

-- RLS Policies
ALTER TABLE whatsapp_validation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own validation codes"
  ON whatsapp_validation_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage validation codes"
  ON whatsapp_validation_codes FOR ALL
  USING (auth.role() = 'service_role');

-- Função para limpar códigos expirados
CREATE OR REPLACE FUNCTION cleanup_expired_validation_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM whatsapp_validation_codes 
  WHERE expires_at < NOW();
END;
$$;