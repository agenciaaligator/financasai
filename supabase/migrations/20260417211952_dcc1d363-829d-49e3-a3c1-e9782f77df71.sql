-- Recreate critical triggers that ensure profile/organization/role/categories
-- are created automatically on new user signup. Without these, signup hangs
-- because downstream code (create-checkout, stripe-webhook) cannot find the
-- profile and organization records.

-- 1. Main trigger on auth.users -> creates profile + organization + member
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_simple();

-- 2. Role trigger on profiles -> assigns default 'free' role
DROP TRIGGER IF EXISTS on_auth_user_created_role ON public.profiles;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 3. Categories trigger on profiles -> creates default categories
DROP TRIGGER IF EXISTS on_profile_created_categories ON public.profiles;
CREATE TRIGGER on_profile_created_categories
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_categories();

-- 4. updated_at triggers (housekeeping, ensure consistency)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organizations_updated_at();

-- 5. Phone validation triggers (prevent invalid phones at DB level)
DROP TRIGGER IF EXISTS validate_profile_phone ON public.profiles;
CREATE TRIGGER validate_profile_phone
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_phone_number();