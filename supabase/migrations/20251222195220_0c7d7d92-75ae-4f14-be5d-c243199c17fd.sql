-- Renovar sessão WhatsApp expirada (+7 dias) e vincular organização
UPDATE whatsapp_sessions 
SET 
  expires_at = NOW() + INTERVAL '7 days',
  last_activity = NOW(),
  organization_id = (
    SELECT organization_id FROM organization_members 
    WHERE user_id = '2efec051-aa64-4f31-8c1b-c22ac51d7d7b' 
    LIMIT 1
  )
WHERE phone_number = '+5511979577468';

-- Normalizar telefone no perfil (adicionar + se não existir)
UPDATE profiles 
SET phone_number = '+5511979577468'
WHERE user_id = '2efec051-aa64-4f31-8c1b-c22ac51d7d7b' 
  AND phone_number = '5511979577468';