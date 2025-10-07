-- Atualizar limites dos planos
-- Plano Free: mais restritivo
UPDATE subscription_plans 
SET max_transactions = 10, max_categories = 5 
WHERE name = 'free';

-- Plano Trial: limites durante período de teste (14 dias)
UPDATE subscription_plans 
SET max_transactions = 100, max_categories = 20 
WHERE name = 'trial';

-- Atualizar preços do Premium com os novos price_id do Stripe
UPDATE subscription_plans
SET 
  stripe_price_id_monthly = 'price_1SFTZoJH1fRNsXz1EJc3R0yl',
  stripe_price_id_yearly = 'price_1SFTaPJH1fRNsXz1pn1ZpzSW',
  price_monthly = 49.90,
  price_yearly = 358.80
WHERE name = 'premium';