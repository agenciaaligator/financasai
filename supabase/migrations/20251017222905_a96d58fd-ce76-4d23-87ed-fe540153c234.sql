-- Modificar função para criar organização automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  org_id uuid;
  user_name text;
BEGIN
  -- Extrair nome do usuário
  user_name := COALESCE(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  -- Create profile with email
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (new.id, user_name, new.email)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = EXCLUDED.email;
  
  -- Criar organização automaticamente para o novo usuário
  INSERT INTO public.organizations (owner_id, name)
  VALUES (new.id, user_name || ' - Organização')
  RETURNING id INTO org_id;
  
  -- Adicionar o usuário como owner da organização
  INSERT INTO public.organization_members (organization_id, user_id, role, permissions)
  VALUES (
    org_id,
    new.id,
    'owner',
    '{"view": true, "create": true, "edit": true, "delete": true}'::jsonb
  );
  
  RETURN new;
END;
$$;