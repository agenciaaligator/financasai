-- ============================================
-- FASE 1: Correções Críticas de Banco de Dados
-- ============================================

-- 1.1. Limpar roles duplicadas mantendo apenas a de maior prioridade
DELETE FROM user_roles WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id 
  FROM user_roles 
  ORDER BY user_id, 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'premium' THEN 2 
      WHEN 'trial' THEN 3 
      WHEN 'free' THEN 4 
    END
);

-- 1.2. Garantir que o plano trial tenha has_multi_user = true
UPDATE subscription_plans 
SET has_multi_user = true 
WHERE name = 'trial' AND has_multi_user = false;