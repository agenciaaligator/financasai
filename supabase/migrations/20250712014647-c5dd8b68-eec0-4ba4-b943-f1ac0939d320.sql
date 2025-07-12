-- Criar função para verificar se email já existe
CREATE OR REPLACE FUNCTION public.check_user_exists(email_to_check text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_count int;
BEGIN
  -- Verifica se existe pelo menos um perfil com esse email
  -- Como não podemos acessar auth.users diretamente, usamos profiles
  SELECT COUNT(*)
  INTO user_count
  FROM auth.users
  WHERE email = email_to_check;
  
  RETURN user_count > 0;
END;
$$;