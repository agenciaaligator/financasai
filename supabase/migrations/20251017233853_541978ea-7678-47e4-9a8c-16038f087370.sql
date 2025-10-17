-- Migração: Atualizar organization_id e permissions para sistema de privacidade

-- 1. Atualizar organization_id nas transações existentes
UPDATE public.transactions t
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE t.user_id = om.user_id
  AND t.organization_id IS NULL;

-- 2. Atualizar organization_id nos commitments existentes
UPDATE public.commitments c
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE c.user_id = om.user_id
  AND c.organization_id IS NULL;

-- 3. Atualizar estrutura de permissions para membros existentes
UPDATE public.organization_members
SET permissions = jsonb_build_object(
  'view', true,
  'create', true,
  'edit', true,
  'delete', true,
  'view_own', true,
  'view_others', CASE 
    WHEN role = 'owner' THEN true
    WHEN role = 'admin' THEN true
    ELSE false
  END,
  'edit_own', true,
  'edit_others', CASE 
    WHEN role = 'owner' THEN true
    WHEN role = 'admin' THEN true
    ELSE false
  END,
  'delete_own', true,
  'delete_others', CASE 
    WHEN role = 'owner' THEN true
    WHEN role = 'admin' THEN true
    ELSE false
  END,
  'view_reports', CASE 
    WHEN role = 'owner' THEN true
    WHEN role = 'admin' THEN true
    ELSE false
  END,
  'manage_members', CASE 
    WHEN role = 'owner' THEN true
    WHEN role = 'admin' THEN true
    ELSE false
  END
)
WHERE permissions IS NOT NULL;