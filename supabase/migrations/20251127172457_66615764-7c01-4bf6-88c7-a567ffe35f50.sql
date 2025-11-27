-- FASE 1: Limpar e Padronizar Planos
-- ==========================================

-- 1. Desativar plano trial (manter apenas free e premium)
UPDATE subscription_plans 
SET is_active = false 
WHERE name = 'trial';

-- 2. Atualizar preços do plano Premium
UPDATE subscription_plans 
SET 
  price_monthly = 29.90,
  price_yearly = 238.80,
  description = 'Plano completo com todos os recursos'
WHERE name = 'premium' AND is_active = true;

-- 3. Garantir que temos apenas UM plano premium ativo
-- Desativar duplicatas mantendo apenas o primeiro
WITH premium_plans AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as rn
  FROM subscription_plans
  WHERE name = 'premium'
)
UPDATE subscription_plans 
SET is_active = false
WHERE id IN (
  SELECT id FROM premium_plans WHERE rn > 1
);