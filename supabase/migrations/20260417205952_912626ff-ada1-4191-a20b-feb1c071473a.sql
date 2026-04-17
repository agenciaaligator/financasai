-- Recreate the missing trigger that fires on new user signup.
-- This trigger calls handle_new_user_simple() which creates the profile,
-- organization, and organization_member records. Without it, signup completes
-- in auth.users but no public-schema records are created, causing the
-- /register flow to hang because downstream functions (create-checkout, 
-- stripe-webhook) cannot find the user's profile/organization.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_simple();

-- Also recreate the role-assignment trigger (default 'free' role)
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- And the default-categories trigger (fires when profile is created)
DROP TRIGGER IF EXISTS on_profile_created_categories ON public.profiles;
CREATE TRIGGER on_profile_created_categories
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_categories();