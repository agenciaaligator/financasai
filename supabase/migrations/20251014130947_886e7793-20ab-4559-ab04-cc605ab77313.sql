-- ============================================
-- FASE 3: Multi-usuário / Organizações
-- ============================================

-- 1. Tabela de Organizações
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Membros da Organização
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '{"view": true, "create": false, "edit": false, "delete": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 3. Adicionar organization_id nas tabelas existentes
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.commitments 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.eventos 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org ON public.transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_commitments_org ON public.commitments(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_org ON public.categories(organization_id);

-- 5. Enable RLS em todas as tabelas
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 6. Função helper para verificar membro da org
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- 7. Função helper para verificar role na org
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;

-- 8. RLS Policies para Organizations
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
USING (
  auth.uid() = owner_id OR
  is_org_member(auth.uid(), id)
);

CREATE POLICY "Owners can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their organizations"
ON public.organizations FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their organizations"
ON public.organizations FOR DELETE
USING (auth.uid() = owner_id);

-- 9. RLS Policies para Organization Members
CREATE POLICY "Members can view org members"
ON public.organization_members FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Owners and admins can add members"
ON public.organization_members FOR INSERT
WITH CHECK (
  has_org_role(auth.uid(), organization_id, 'owner') OR
  has_org_role(auth.uid(), organization_id, 'admin')
);

CREATE POLICY "Owners and admins can update members"
ON public.organization_members FOR UPDATE
USING (
  has_org_role(auth.uid(), organization_id, 'owner') OR
  has_org_role(auth.uid(), organization_id, 'admin')
);

CREATE POLICY "Owners and admins can remove members"
ON public.organization_members FOR DELETE
USING (
  has_org_role(auth.uid(), organization_id, 'owner') OR
  has_org_role(auth.uid(), organization_id, 'admin')
);

-- 10. Atualizar RLS Policies de Transactions para multi-org
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view org transactions"
ON public.transactions FOR SELECT
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
CREATE POLICY "Users can create org transactions"
ON public.transactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update org transactions"
ON public.transactions FOR UPDATE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'admin'))
);

DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
CREATE POLICY "Users can delete org transactions"
ON public.transactions FOR DELETE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'admin'))
);

-- 11. Atualizar RLS Policies de Commitments para multi-org
DROP POLICY IF EXISTS "Users can view own commitments" ON public.commitments;
CREATE POLICY "Users can view org commitments"
ON public.commitments FOR SELECT
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Users can create own commitments" ON public.commitments;
CREATE POLICY "Users can create org commitments"
ON public.commitments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Users can update own commitments" ON public.commitments;
CREATE POLICY "Users can update org commitments"
ON public.commitments FOR UPDATE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'admin'))
);

DROP POLICY IF EXISTS "Users can delete own commitments" ON public.commitments;
CREATE POLICY "Users can delete org commitments"
ON public.commitments FOR DELETE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'admin'))
);

-- 12. Atualizar RLS Policies de Categories para multi-org
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categories;
CREATE POLICY "Users can view org categories"
ON public.categories FOR SELECT
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Users can create their own categories" ON public.categories;
CREATE POLICY "Users can create org categories"
ON public.categories FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
);

DROP POLICY IF EXISTS "Users can update their own categories" ON public.categories;
CREATE POLICY "Users can update org categories"
ON public.categories FOR UPDATE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'admin'))
);

DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categories;
CREATE POLICY "Users can delete org categories"
ON public.categories FOR DELETE
USING (
  auth.uid() = user_id OR
  (organization_id IS NOT NULL AND has_org_role(auth.uid(), organization_id, 'admin'))
);

-- 13. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_organizations_updated_at();

CREATE TRIGGER update_org_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.update_organizations_updated_at();

-- 14. Migração de dados existentes: criar org padrão para cada usuário
INSERT INTO public.organizations (owner_id, name)
SELECT 
  p.user_id,
  'Minha Organização - ' || COALESCE(p.full_name, p.email)
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations o WHERE o.owner_id = p.user_id
)
ON CONFLICT DO NOTHING;

-- 15. Adicionar cada owner como membro da própria org
INSERT INTO public.organization_members (organization_id, user_id, role, permissions)
SELECT 
  o.id,
  o.owner_id,
  'owner',
  '{"view": true, "create": true, "edit": true, "delete": true}'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_members om 
  WHERE om.organization_id = o.id AND om.user_id = o.owner_id
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 16. Vincular transactions existentes à org do owner
UPDATE public.transactions t
SET organization_id = o.id
FROM public.organizations o
WHERE t.user_id = o.owner_id
  AND t.organization_id IS NULL;

-- 17. Vincular commitments existentes à org do owner
UPDATE public.commitments c
SET organization_id = o.id
FROM public.organizations o
WHERE c.user_id = o.owner_id
  AND c.organization_id IS NULL;

-- 18. Vincular categories existentes à org do owner
UPDATE public.categories cat
SET organization_id = o.id
FROM public.organizations o
WHERE cat.user_id = o.owner_id
  AND cat.organization_id IS NULL;