-- CORREÇÃO 4: Permitir membros da organização verem perfis uns dos outros
-- Isso corrige o problema do badge de autor não aparecer para membros

-- Adicionar policy RLS em profiles para membros da mesma organização verem uns aos outros
CREATE POLICY "Org members can view other members profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om1
      WHERE om1.user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.organization_members om2
          WHERE om2.organization_id = om1.organization_id
            AND om2.user_id = profiles.user_id
        )
    )
  );

-- Verificar que a policy foi criada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
      AND policyname = 'Org members can view other members profiles'
  ) THEN
    RAISE EXCEPTION 'Policy "Org members can view other members profiles" não foi criada';
  END IF;
END $$;