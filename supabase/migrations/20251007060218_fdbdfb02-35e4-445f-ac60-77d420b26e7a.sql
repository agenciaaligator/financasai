-- Primeiro, vamos garantir que existe um plano premium ativo
DO $$
DECLARE
  v_premium_plan_id UUID;
  v_user_id UUID;
BEGIN
  -- Pegar o plano premium
  SELECT id INTO v_premium_plan_id
  FROM public.subscription_plans
  WHERE role = 'premium'
  LIMIT 1;

  -- Se não existir, criar
  IF v_premium_plan_id IS NULL THEN
    INSERT INTO public.subscription_plans (
      name,
      display_name,
      description,
      role,
      price_monthly,
      price_yearly,
      max_transactions,
      max_categories,
      has_whatsapp,
      has_ai_reports,
      has_google_calendar,
      has_bank_integration,
      has_multi_user,
      has_priority_support,
      is_active
    ) VALUES (
      'lifetime_admin',
      'Admin Vitalício',
      'Acesso completo vitalício para testes',
      'premium',
      0,
      0,
      NULL, -- ilimitado
      NULL, -- ilimitado
      true,
      true,
      true,
      true,
      true,
      true,
      true
    )
    RETURNING id INTO v_premium_plan_id;
  END IF;

  -- Pegar o primeiro usuário autenticado (assumindo que é você)
  -- Se houver mais usuários, você pode ajustar isso
  SELECT user_id INTO v_user_id
  FROM public.profiles
  ORDER BY created_at ASC
  LIMIT 1;

  -- Adicionar role admin vitalício
  INSERT INTO public.user_roles (user_id, role, expires_at)
  VALUES (v_user_id, 'admin', NULL) -- NULL = vitalício
  ON CONFLICT (user_id, role) DO UPDATE
  SET expires_at = NULL;

  -- Adicionar subscription vitalícia
  INSERT INTO public.user_subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    billing_cycle
  )
  VALUES (
    v_user_id,
    v_premium_plan_id,
    'active',
    NOW(),
    '2099-12-31'::timestamp, -- Data muito no futuro
    'lifetime'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    plan_id = v_premium_plan_id,
    status = 'active',
    current_period_start = NOW(),
    current_period_end = '2099-12-31'::timestamp,
    billing_cycle = 'lifetime';

  RAISE NOTICE 'Acesso admin vitalício configurado para usuário %', v_user_id;
END $$;