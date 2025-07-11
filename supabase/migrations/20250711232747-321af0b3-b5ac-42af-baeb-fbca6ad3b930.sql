-- Verificar se há emails duplicados e corrigir validação no auth
-- Esta query irá identificar possíveis problemas com emails duplicados

-- Primeiro, vamos verificar se há perfis duplicados
SELECT user_id, COUNT(*) as count 
FROM profiles 
GROUP BY user_id 
HAVING COUNT(*) > 1;

-- Adicionar constraint para garantir que não haverá duplicatas futuras
-- (A constraint unique já existe, mas vamos garantir que funcione)
DO $$ 
BEGIN
    -- Verificar se a constraint existe e recriar se necessário
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_user_id_key' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- Melhorar a função que cria perfil para evitar duplicatas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Usar INSERT ... ON CONFLICT para evitar duplicatas
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN new;
END;
$function$;

-- Recriar trigger para garantir que funcione corretamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para verificar e limpar duplicatas em profiles
CREATE OR REPLACE FUNCTION clean_duplicate_profiles()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove perfis duplicados mantendo apenas o mais recente
  DELETE FROM profiles 
  WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM profiles
    ORDER BY user_id, created_at DESC
  );
END;
$$;

-- Executar limpeza de duplicatas
SELECT clean_duplicate_profiles();