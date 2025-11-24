-- FASE 1: Corrigir função handle_new_user_simple para salvar phone_number
CREATE OR REPLACE FUNCTION public.handle_new_user_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  org_id uuid;
  user_name text;
  user_phone text;
BEGIN
  -- Extrair dados do usuário
  user_name := COALESCE(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  user_phone := new.raw_user_meta_data ->> 'phone_number';

  -- Create profile with email AND phone_number
  INSERT INTO public.profiles (user_id, full_name, email, phone_number)
  VALUES (new.id, user_name, new.email, user_phone)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = EXCLUDED.email,
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number);
  
  -- Criar organização automaticamente
  INSERT INTO public.organizations (owner_id, name)
  VALUES (new.id, user_name || ' - Organização')
  RETURNING id INTO org_id;
  
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