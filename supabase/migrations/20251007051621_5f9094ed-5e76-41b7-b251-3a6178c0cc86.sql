-- Atualizar plano Premium com os price IDs do Stripe
UPDATE subscription_plans
SET 
  stripe_price_id_monthly = 'price_1SFTA4JH1fRNsXz1VdkYkfEg',
  stripe_price_id_yearly = 'price_1SFTBQJH1fRNsXz1MXPjabkC'
WHERE name = 'premium';