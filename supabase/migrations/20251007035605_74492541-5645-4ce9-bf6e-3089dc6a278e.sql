-- ============================================================
-- MIGRATION 1.2: Estrutura de Planos de Assinatura
-- ============================================================

-- 1. Tabela de planos disponíveis
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  role public.app_role NOT NULL,
  
  -- Limites de recursos
  max_transactions INTEGER, -- NULL = ilimitado
  max_categories INTEGER, -- NULL = ilimitado
  has_whatsapp BOOLEAN DEFAULT false,
  has_ai_reports BOOLEAN DEFAULT false,
  has_google_calendar BOOLEAN DEFAULT false,
  has_bank_integration BOOLEAN DEFAULT false,
  has_multi_user BOOLEAN DEFAULT false,
  has_priority_support BOOLEAN DEFAULT false,
  
  -- Promoções e descontos
  discount_percentage INTEGER DEFAULT 0,
  promotional_price DECIMAL(10,2),
  promotion_valid_until TIMESTAMPTZ,
  
  -- IDs dos gateways de pagamento
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  mercadopago_plan_id TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Inserir planos padrão
INSERT INTO public.subscription_plans 
  (name, display_name, description, price_monthly, price_yearly, role, max_transactions, max_categories, has_whatsapp, has_ai_reports, has_google_calendar, has_bank_integration, has_multi_user, has_priority_support) 
VALUES
  (
    'free', 
    'Gratuito', 
    'Plano básico para começar a organizar suas finanças', 
    0, 
    0, 
    'free', 
    50, -- Limite de 50 transações
    10, -- Limite de 10 categorias
    true, -- WhatsApp incluído
    false, 
    false, 
    false, 
    false, 
    false
  ),
  (
    'trial', 
    'Trial Premium', 
    'Teste grátis por 14 dias - todas as funcionalidades premium', 
    0, 
    0, 
    'trial', 
    NULL, -- Ilimitado durante trial
    NULL, -- Ilimitado durante trial
    true, 
    true, 
    true, 
    false, -- Integração bancária não disponível no trial
    false, 
    true
  ),
  (
    'premium', 
    'Premium', 
    'Acesso completo a todas as funcionalidades - sem limites', 
    29.90, 
    299.00, 
    'premium', 
    NULL, -- Ilimitado
    NULL, -- Ilimitado
    true, 
    true, 
    true, 
    true, 
    true, 
    true
  );

-- 3. Tabela de assinaturas dos usuários
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, expired, pending
  billing_cycle TEXT DEFAULT 'monthly', -- monthly, yearly
  
  -- Dados de pagamento (Stripe)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  
  -- Dados de pagamento (MercadoPago)
  mercadopago_customer_id TEXT,
  mercadopago_subscription_id TEXT,
  
  payment_gateway TEXT DEFAULT 'stripe', -- stripe, mercadopago
  
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- 4. Criar índices para performance
CREATE INDEX idx_subscription_plans_role ON public.subscription_plans(role);
CREATE INDEX idx_subscription_plans_is_active ON public.subscription_plans(is_active);
CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_stripe_customer ON public.user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_mercadopago_customer ON public.user_subscriptions(mercadopago_customer_id);

-- 5. Habilitar RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies - subscription_plans
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans 
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage all plans"
  ON public.subscription_plans 
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. RLS Policies - user_subscriptions
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions 
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.user_subscriptions 
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all subscriptions"
  ON public.user_subscriptions 
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Trigger: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_subscription_plans_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_subscription_plans_updated_at_trigger
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_plans_updated_at();

CREATE OR REPLACE FUNCTION public.update_user_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_subscriptions_updated_at_trigger
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_subscriptions_updated_at();

-- 9. Function: obter plano ativo do usuário
CREATE OR REPLACE FUNCTION public.get_user_active_plan(_user_id uuid)
RETURNS TABLE (
  plan_name text,
  max_transactions integer,
  max_categories integer,
  has_whatsapp boolean,
  has_ai_reports boolean,
  has_google_calendar boolean,
  has_bank_integration boolean,
  has_multi_user boolean,
  has_priority_support boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sp.name,
    sp.max_transactions,
    sp.max_categories,
    sp.has_whatsapp,
    sp.has_ai_reports,
    sp.has_google_calendar,
    sp.has_bank_integration,
    sp.has_multi_user,
    sp.has_priority_support
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = _user_id 
    AND us.status = 'active'
  LIMIT 1;
$$;