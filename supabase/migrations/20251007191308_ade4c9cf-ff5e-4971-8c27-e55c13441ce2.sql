-- Criar tabela de cupons de desconto
CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('full_access', 'discount_percent', 'discount_fixed')),
  value numeric,
  max_uses integer,
  current_uses integer DEFAULT 0,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Criar tabela de cupons aplicados aos usuários
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coupon_id uuid NOT NULL REFERENCES public.discount_coupons(id) ON DELETE CASCADE,
  applied_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, coupon_id)
);

-- Habilitar RLS
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para discount_coupons
CREATE POLICY "Admins podem gerenciar cupons"
  ON public.discount_coupons
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem ver cupons ativos"
  ON public.discount_coupons
  FOR SELECT
  USING (is_active = true);

-- Políticas RLS para user_coupons
CREATE POLICY "Admins podem gerenciar user_coupons"
  ON public.user_coupons
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver seus próprios cupons"
  ON public.user_coupons
  FOR SELECT
  USING (auth.uid() = user_id);

-- Inserir cupom FULLACCESS
INSERT INTO public.discount_coupons (code, type, note, is_active)
VALUES ('FULLACCESS', 'full_access', 'Acesso total sem limitações', true)
ON CONFLICT (code) DO NOTHING;

-- Garantir que o usuário tem role admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'contato@aligator.com.br'
ON CONFLICT (user_id, role) DO NOTHING;

-- Aplicar cupom FULLACCESS ao usuário
INSERT INTO public.user_coupons (user_id, coupon_id)
SELECT u.id, c.id
FROM auth.users u
CROSS JOIN public.discount_coupons c
WHERE u.email = 'contato@aligator.com.br' 
  AND c.code = 'FULLACCESS'
ON CONFLICT (user_id, coupon_id) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_discount_coupons_updated_at
  BEFORE UPDATE ON public.discount_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();