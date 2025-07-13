-- Temporarily disable the custom email hook to allow user registration
-- This is because the HTTP extension has some dependency issues

-- Drop the existing trigger that causes the error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create a simple trigger that doesn't use HTTP calls
CREATE OR REPLACE FUNCTION public.handle_new_user_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Only create the profile, without sending custom emails
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  RETURN new;
END;
$$;

-- Create new trigger with the simplified function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_simple();