-- Limpeza de dados órfãos do usuário alexandremkt@hotmail.com

-- 1. Deletar organização órfã
DELETE FROM organizations WHERE id = '64137da9-3f95-4f8a-9dea-d4d7b24e20e8';

-- 2. Limpar códigos de validação antigos do número
DELETE FROM whatsapp_validation_codes WHERE phone_number LIKE '%11911751247%';