-- Corrigir plano Trial para ter limites ilimitados
UPDATE subscription_plans
SET 
  max_transactions = NULL,
  max_categories = NULL
WHERE name = 'trial';

-- Criar cupom FUTEBOL2024 para amigos do futebol
INSERT INTO discount_coupons (
  code,
  type,
  value,
  max_uses,
  current_uses,
  is_active,
  note
) VALUES (
  'FUTEBOL2024',
  'full_access',
  NULL,
  10,
  0,
  true,
  'Cupom para amigos do futebol - acesso completo por 30 dias'
)
ON CONFLICT (code) DO UPDATE SET
  is_active = true,
  max_uses = 10,
  note = 'Cupom para amigos do futebol - acesso completo por 30 dias';