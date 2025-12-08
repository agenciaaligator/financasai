-- Atualizar subscription_plans para usar os price_ids do pricing.ts (modo test)
UPDATE subscription_plans
SET 
  stripe_price_id_monthly = 'price_1SbmlUJH1fRNsXz1xV238gzq',
  stripe_price_id_yearly = 'price_1SbqsUJH1fRNsXz1DEQjETOw'
WHERE name = 'premium' AND is_active = true;

-- Limpar dados do usuário de teste agenciaaligator@gmail.com
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Buscar user_id pelo email do profile
  SELECT user_id INTO v_user_id FROM profiles WHERE email = 'agenciaaligator@gmail.com' LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    DELETE FROM work_hours WHERE user_id = v_user_id;
    DELETE FROM categories WHERE user_id = v_user_id;
    DELETE FROM organization_members WHERE user_id = v_user_id;
    DELETE FROM organizations WHERE owner_id = v_user_id;
    DELETE FROM user_subscriptions WHERE user_id = v_user_id;
    DELETE FROM user_roles WHERE user_id = v_user_id;
    DELETE FROM profiles WHERE user_id = v_user_id;
    DELETE FROM whatsapp_sessions WHERE user_id = v_user_id;
  END IF;
END $$;