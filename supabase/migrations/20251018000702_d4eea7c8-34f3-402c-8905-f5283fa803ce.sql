-- 1. Criar perfis faltantes para usuários sem profile
INSERT INTO public.profiles (user_id, email)
SELECT au.id, au.email
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Adicionar índice único em profiles.user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- 3. Adicionar foreign keys
ALTER TABLE public.organization_members
DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey,
ADD CONSTRAINT organization_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_user_id_fkey,
ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- 4. Criar função SECURITY DEFINER para verificar permissões da organização
CREATE OR REPLACE FUNCTION public.has_org_permission(_user_id uuid, _org_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (permissions->>_permission_key)::boolean
      FROM public.organization_members
      WHERE user_id = _user_id
        AND organization_id = _org_id
    ),
    false
  )
$$;

-- 5. Atualizar políticas RLS para transactions
DROP POLICY IF EXISTS "Users can view org transactions" ON public.transactions;
CREATE POLICY "Users can view org transactions"
ON public.transactions
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (
    organization_id IS NOT NULL 
    AND (
      has_org_permission(auth.uid(), organization_id, 'view_others')
      OR has_org_role(auth.uid(), organization_id, 'owner')
      OR has_org_role(auth.uid(), organization_id, 'admin')
    )
  )
);

DROP POLICY IF EXISTS "Users can update org transactions" ON public.transactions;
CREATE POLICY "Users can update org transactions"
ON public.transactions
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR (
    organization_id IS NOT NULL 
    AND has_org_permission(auth.uid(), organization_id, 'edit_others')
  )
);

DROP POLICY IF EXISTS "Users can delete org transactions" ON public.transactions;
CREATE POLICY "Users can delete org transactions"
ON public.transactions
FOR DELETE
USING (
  auth.uid() = user_id 
  OR (
    organization_id IS NOT NULL 
    AND has_org_permission(auth.uid(), organization_id, 'delete_others')
  )
);

-- 6. Atualizar políticas RLS para commitments
DROP POLICY IF EXISTS "Users can view org commitments" ON public.commitments;
CREATE POLICY "Users can view org commitments"
ON public.commitments
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (
    organization_id IS NOT NULL 
    AND (
      has_org_permission(auth.uid(), organization_id, 'view_others')
      OR has_org_role(auth.uid(), organization_id, 'owner')
      OR has_org_role(auth.uid(), organization_id, 'admin')
    )
  )
);

DROP POLICY IF EXISTS "Users can update org commitments" ON public.commitments;
CREATE POLICY "Users can update org commitments"
ON public.commitments
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR (
    organization_id IS NOT NULL 
    AND has_org_permission(auth.uid(), organization_id, 'edit_others')
  )
);

DROP POLICY IF EXISTS "Users can delete org commitments" ON public.commitments;
CREATE POLICY "Users can delete org commitments"
ON public.commitments
FOR DELETE
USING (
  auth.uid() = user_id 
  OR (
    organization_id IS NOT NULL 
    AND has_org_permission(auth.uid(), organization_id, 'delete_others')
  )
);

-- 7. Criar RPC para obter limites do plano da organização (herança)
CREATE OR REPLACE FUNCTION public.get_org_plan_limits(_user_id uuid)
RETURNS TABLE(
  plan_name text,
  max_transactions integer,
  max_categories integer,
  has_whatsapp boolean,
  has_ai_reports boolean,
  has_google_calendar boolean,
  has_bank_integration boolean,
  has_multi_user boolean,
  has_priority_support boolean,
  is_inherited boolean,
  owner_email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id uuid;
  owner_user_id uuid;
BEGIN
  -- Encontrar a organização do usuário (preferir membership onde não é owner)
  SELECT organization_id INTO org_id
  FROM public.organization_members
  WHERE user_id = _user_id
    AND role != 'owner'
  LIMIT 1;
  
  -- Se não encontrou, pegar qualquer organização
  IF org_id IS NULL THEN
    SELECT organization_id INTO org_id
    FROM public.organization_members
    WHERE user_id = _user_id
    LIMIT 1;
  END IF;
  
  -- Se não pertence a nenhuma organização, retornar vazio
  IF org_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Pegar o owner_id da organização
  SELECT o.owner_id INTO owner_user_id
  FROM public.organizations o
  WHERE o.id = org_id;
  
  -- Retornar os limites do plano do owner
  RETURN QUERY
  SELECT 
    sp.name,
    sp.max_transactions,
    sp.max_categories,
    sp.has_whatsapp,
    sp.has_ai_reports,
    sp.has_google_calendar,
    sp.has_bank_integration,
    sp.has_multi_user,
    sp.has_priority_support,
    true as is_inherited,
    p.email as owner_email
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  JOIN public.profiles p ON p.user_id = owner_user_id
  WHERE us.user_id = owner_user_id
    AND us.status = 'active'
  LIMIT 1;
END;
$$;