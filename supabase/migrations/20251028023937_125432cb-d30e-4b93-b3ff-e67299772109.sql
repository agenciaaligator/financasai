-- ====================================================================
-- BACKFILL: Adicionar organization_id em transações antigas do WhatsApp
-- ====================================================================
-- 
-- PROBLEMA: Transações criadas via WhatsApp antes desta correção 
-- não possuem organization_id, fazendo com que não apareçam no 
-- dashboard para membros com view_others = true.
--
-- SOLUÇÃO: Atualizar transações antigas buscando organization_id
-- do usuário na tabela organization_members.
-- ====================================================================

-- Atualizar transações do WhatsApp sem organization_id
UPDATE transactions t
SET organization_id = (
  SELECT organization_id 
  FROM organization_members om 
  WHERE om.user_id = t.user_id 
  ORDER BY om.created_at DESC 
  LIMIT 1
)
WHERE t.organization_id IS NULL 
  AND t.source = 'whatsapp'
  AND EXISTS (
    SELECT 1 
    FROM organization_members om2 
    WHERE om2.user_id = t.user_id
  );

-- Log do resultado
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM transactions 
  WHERE source = 'whatsapp' 
    AND organization_id IS NOT NULL;
  
  RAISE NOTICE 'Backfill concluído: % transações do WhatsApp com organization_id', updated_count;
END $$;