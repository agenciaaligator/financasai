-- Permitir códigos de validação sem user_id (fluxo de cadastro por WhatsApp)
ALTER TABLE whatsapp_validation_codes
  ALTER COLUMN user_id DROP NOT NULL;