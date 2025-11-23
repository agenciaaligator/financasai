-- Adicionar coluna phone_number à tabela whatsapp_validation_codes
ALTER TABLE whatsapp_validation_codes 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_whatsapp_validation_codes_phone 
ON whatsapp_validation_codes(phone_number);

-- Adicionar índice para códigos não usados e não expirados
CREATE INDEX IF NOT EXISTS idx_whatsapp_validation_codes_active 
ON whatsapp_validation_codes(phone_number, used, expires_at) 
WHERE used = false;