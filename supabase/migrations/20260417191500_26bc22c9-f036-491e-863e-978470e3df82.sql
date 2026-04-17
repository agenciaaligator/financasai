-- Adicionar coluna claim_code para validação reversa de WhatsApp
ALTER TABLE public.whatsapp_validation_codes 
  ADD COLUMN IF NOT EXISTS claim_code TEXT;

-- Índice único para lookup rápido no webhook (case-insensitive via UPPER)
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_validation_codes_claim_code_unused 
  ON public.whatsapp_validation_codes (claim_code) 
  WHERE used = false AND claim_code IS NOT NULL;

-- Índice para buscar último claim do usuário
CREATE INDEX IF NOT EXISTS idx_whatsapp_validation_codes_user_pending 
  ON public.whatsapp_validation_codes (user_id, expires_at DESC) 
  WHERE used = false AND claim_code IS NOT NULL;