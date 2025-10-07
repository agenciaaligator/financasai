-- =====================================================
-- FASE 1.1.1: Proteção Master User e Correções Críticas
-- =====================================================

-- 1. Criar tabela master_users
CREATE TABLE IF NOT EXISTS public.master_users (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir o usuário master (contato@aligator.com.br)
INSERT INTO public.master_users (user_id, email)
SELECT user_id, email 
FROM public.profiles 
WHERE email = 'contato@aligator.com.br'
ON CONFLICT (user_id) DO NOTHING;

-- 2. Criar função is_master_user
CREATE OR REPLACE FUNCTION public.is_master_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.master_users
    WHERE user_id = _user_id
  )
$$;

-- 3. Limpar roles duplicadas do usuário master
-- Deletar todas as roles do master exceto admin
DELETE FROM public.user_roles
WHERE user_id IN (SELECT user_id FROM public.master_users)
  AND role != 'admin';

-- Garantir que master tem role admin sem expiração
INSERT INTO public.user_roles (user_id, role, expires_at)
SELECT user_id, 'admin'::app_role, NULL
FROM public.master_users
ON CONFLICT (user_id, role) 
DO UPDATE SET expires_at = NULL;

-- 4. Atualizar RLS policies em user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

CREATE POLICY "Admins and masters can manage all roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

CREATE POLICY "Admins and masters can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

-- 5. Atualizar RLS policies em user_subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;

CREATE POLICY "Admins and masters can manage subscriptions"
ON public.user_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

CREATE POLICY "Admins and masters can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

-- 6. Atualizar RLS policies em profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins and masters can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

-- 7. Limpar assinaturas "free" (não deveriam existir)
DELETE FROM public.user_subscriptions
WHERE plan_id IN (
  SELECT id FROM public.subscription_plans WHERE name = 'free'
);

-- 8. Enable RLS on master_users
ALTER TABLE public.master_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins and masters can view master users"
ON public.master_users
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

CREATE POLICY "Nobody can modify master users table"
ON public.master_users
FOR ALL
USING (false)
WITH CHECK (false);