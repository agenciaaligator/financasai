-- Primeiro, vamos recriar o trigger para criar categorias padrão
-- que foi perdido ou não funcionou corretamente

-- Criar trigger para criar perfil automaticamente quando usuário se cadastra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Criar trigger para criar categorias padrão quando perfil é criado
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

-- Inserir perfil para usuários existentes que não têm perfil
INSERT INTO public.profiles (user_id, full_name) 
SELECT id, raw_user_meta_data ->> 'full_name'
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.profiles);

-- Inserir categorias padrão para usuários que não têm categorias
INSERT INTO public.categories (user_id, name, type, color) 
SELECT p.user_id, 'Alimentação', 'expense', '#EF4444'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Transporte', 'expense', '#F59E0B'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Moradia', 'expense', '#8B5CF6'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Saúde', 'expense', '#10B981'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Entretenimento', 'expense', '#EC4899'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Educação', 'expense', '#3B82F6'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Vestuário', 'expense', '#F97316'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Outros', 'expense', '#6B7280'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Salário', 'income', '#059669'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Freelance', 'income', '#0D9488'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Investimentos', 'income', '#0891B2'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories)
UNION ALL
SELECT p.user_id, 'Outros', 'income', '#16A34A'
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT DISTINCT user_id FROM public.categories);