-- Adicionar coluna email à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Atualizar função handle_new_user_simple para incluir email
CREATE OR REPLACE FUNCTION public.handle_new_user_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Create profile with email
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    email = EXCLUDED.email;
  
  RETURN new;
END;
$$;

-- Adicionar política RLS para admins verem todos os perfis
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Popular emails existentes (buscar da tabela auth.users)
-- Nota: Isso será feito via trigger nas próximas inserções, 
-- mas vamos garantir que os perfis existentes tenham email
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT au.id, au.email 
    FROM auth.users au
    INNER JOIN public.profiles p ON p.user_id = au.id
    WHERE p.email IS NULL
  LOOP
    UPDATE public.profiles 
    SET email = user_record.email 
    WHERE user_id = user_record.id;
  END LOOP;
END $$;