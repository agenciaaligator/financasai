-- Security fixes to resolve Supabase Security Advisor warnings

-- 1. Remove triggers that depend on functions we want to drop
DROP TRIGGER IF EXISTS create_default_categories_trigger ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

-- 2. Fix functions with mutable search path by recreating them with SET search_path = ''
CREATE OR REPLACE FUNCTION public.clean_duplicate_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Remove perfis duplicados mantendo apenas o mais recente
  DELETE FROM public.profiles 
  WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM public.profiles
    ORDER BY user_id, created_at DESC
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the categories function with proper security settings
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Default expense categories
  INSERT INTO public.categories (user_id, name, type, color) VALUES
    (NEW.user_id, 'Alimentação', 'expense', '#EF4444'),
    (NEW.user_id, 'Transporte', 'expense', '#F59E0B'),
    (NEW.user_id, 'Moradia', 'expense', '#8B5CF6'),
    (NEW.user_id, 'Saúde', 'expense', '#10B981'),
    (NEW.user_id, 'Entretenimento', 'expense', '#EC4899'),
    (NEW.user_id, 'Educação', 'expense', '#3B82F6'),
    (NEW.user_id, 'Vestuário', 'expense', '#F97316'),
    (NEW.user_id, 'Outros', 'expense', '#6B7280');
  
  -- Default income categories
  INSERT INTO public.categories (user_id, name, type, color) VALUES
    (NEW.user_id, 'Salário', 'income', '#059669'),
    (NEW.user_id, 'Freelance', 'income', '#0D9488'),
    (NEW.user_id, 'Investimentos', 'income', '#0891B2'),
    (NEW.user_id, 'Outros', 'income', '#16A34A');
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger for default categories
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_categories();

-- 3. Remove the HTTP extension from public schema since we're not using custom emails anymore
DROP EXTENSION IF EXISTS http CASCADE;

-- 4. Clean up unused function
DROP FUNCTION IF EXISTS public.handle_new_user();