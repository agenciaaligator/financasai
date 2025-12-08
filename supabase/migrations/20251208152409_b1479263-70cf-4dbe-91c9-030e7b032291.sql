-- Corrigir a conta de teste alexandremkt@hotmail.com
-- User ID: 23cb5f4c-477e-4359-8441-1d56c063c74e

-- 1. Buscar o plano premium
DO $$
DECLARE
  v_plan_id uuid;
  v_user_id uuid := '23cb5f4c-477e-4359-8441-1d56c063c74e';
BEGIN
  -- Buscar plano premium ativo
  SELECT id INTO v_plan_id FROM subscription_plans WHERE name = 'premium' AND is_active = true LIMIT 1;
  
  -- Criar user_subscriptions se não existir
  INSERT INTO user_subscriptions (
    user_id, 
    plan_id, 
    status, 
    billing_cycle, 
    payment_gateway,
    current_period_start,
    current_period_end
  ) VALUES (
    v_user_id,
    v_plan_id,
    'active',
    'monthly',
    'stripe',
    NOW(),
    NOW() + INTERVAL '1 month'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    billing_cycle = 'monthly',
    payment_gateway = 'stripe',
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 month',
    updated_at = NOW();
  
  -- Atualizar user_roles para premium
  UPDATE user_roles 
  SET role = 'premium', updated_at = NOW(), expires_at = NULL
  WHERE user_id = v_user_id;
END $$;