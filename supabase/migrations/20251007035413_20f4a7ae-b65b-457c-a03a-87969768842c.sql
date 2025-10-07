-- ============================================================
-- MIGRATION 1.1: Sistema de Roles e Permissões
-- ============================================================

-- 1. Criar enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'premium', 'free', 'trial');

-- 2. Criar tabela user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Para trials (14 dias)
  UNIQUE(user_id, role)
);

-- 3. Criar índices para performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);
CREATE INDEX idx_user_roles_expires_at ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- 4. Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Security Definer Function: verificar se usuário tem role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = _role
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- 6. Security Definer Function: obter role principal do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'premium' THEN 2
      WHEN 'trial' THEN 3
      WHEN 'free' THEN 4
    END
  LIMIT 1
$$;

-- 7. Trigger function: atribuir role 'free' automaticamente para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'free')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 8. Trigger: executar após criação de profile
CREATE TRIGGER on_profile_created_assign_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 9. RLS Policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles 
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles 
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles 
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 10. Function: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_user_roles_updated_at()
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

CREATE TRIGGER update_user_roles_updated_at_trigger
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_roles_updated_at();

-- 11. Promover agenciaaligator@gmail.com a admin master
DO $$
DECLARE
  master_user_id uuid;
BEGIN
  -- Buscar user_id do email master
  SELECT id INTO master_user_id
  FROM auth.users
  WHERE email = 'agenciaaligator@gmail.com';

  -- Se existir, promover a admin
  IF master_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (master_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin master % promovido com sucesso!', 'agenciaaligator@gmail.com';
  ELSE
    RAISE NOTICE 'Email % ainda não cadastrado. Role admin será atribuída após primeiro login.', 'agenciaaligator@gmail.com';
  END IF;
END $$;