-- CORREÇÃO 1: Adicionar FK explícita para organization_invitations.invited_by
-- Isso corrige o erro "Erro ao carregar convites" que ocorre devido ao nome de FK inexistente

-- Remover FK genérica se existir
ALTER TABLE public.organization_invitations 
DROP CONSTRAINT IF EXISTS organization_invitations_invited_by_fkey;

-- Criar FK com nome explícito (auth.users é referenciável via FK)
ALTER TABLE public.organization_invitations 
ADD CONSTRAINT organization_invitations_invited_by_fkey 
FOREIGN KEY (invited_by) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Verificar que a constraint foi criada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'organization_invitations_invited_by_fkey'
      AND table_name = 'organization_invitations'
  ) THEN
    RAISE EXCEPTION 'FK organization_invitations_invited_by_fkey não foi criada';
  END IF;
END $$;