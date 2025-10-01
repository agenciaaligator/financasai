-- Add phone_number column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number TEXT UNIQUE;

-- Add index for better performance on phone number lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);

-- Add validation trigger for phone number format
CREATE OR REPLACE FUNCTION public.validate_profile_phone_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow NULL phone numbers (optional field)
  IF NEW.phone_number IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Ensure phone number has reasonable length and format
  IF LENGTH(TRIM(NEW.phone_number)) < 10 THEN
    RAISE EXCEPTION 'Invalid phone number: must be at least 10 characters';
  END IF;
  
  -- Ensure phone number only contains digits and optional + prefix
  IF NEW.phone_number !~ '^\+?[0-9]{10,20}$' THEN
    RAISE EXCEPTION 'Invalid phone number format: must contain only digits and optional + prefix';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply validation trigger to profiles
DROP TRIGGER IF EXISTS validate_profile_phone ON public.profiles;
CREATE TRIGGER validate_profile_phone
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_phone_number();

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.phone_number IS 'WhatsApp phone number in international format (e.g., 5511999999999)';