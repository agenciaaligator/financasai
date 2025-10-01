-- CRITICAL SECURITY FIX: Fix WhatsApp Sessions RLS Policy
-- The current policy allows anyone to access any session (USING true)
-- This is a critical security vulnerability that allows session hijacking

-- Drop the existing dangerous policy
DROP POLICY IF EXISTS "Service role can manage all sessions" ON public.whatsapp_sessions;

-- Create secure, restrictive policies for WhatsApp sessions
-- Only service role can create sessions
CREATE POLICY "Service role can create sessions"
  ON public.whatsapp_sessions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only service role can read sessions
CREATE POLICY "Service role can read sessions"
  ON public.whatsapp_sessions
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Only service role can update sessions
CREATE POLICY "Service role can update sessions"
  ON public.whatsapp_sessions
  FOR UPDATE
  USING (auth.role() = 'service_role');

-- Only service role can delete sessions
CREATE POLICY "Service role can delete sessions"
  ON public.whatsapp_sessions
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone_number ON public.whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user_id ON public.whatsapp_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_expires_at ON public.whatsapp_sessions(expires_at);

-- Add validation trigger to ensure phone numbers are valid
CREATE OR REPLACE FUNCTION public.validate_whatsapp_phone_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure phone number is not empty and has reasonable length
  IF NEW.phone_number IS NULL OR LENGTH(TRIM(NEW.phone_number)) < 10 THEN
    RAISE EXCEPTION 'Invalid phone number: must be at least 10 characters';
  END IF;
  
  -- Ensure phone number only contains digits and optional + prefix
  IF NEW.phone_number !~ '^\+?[0-9]{10,20}$' THEN
    RAISE EXCEPTION 'Invalid phone number format: must contain only digits and optional + prefix';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply validation trigger to sessions
DROP TRIGGER IF EXISTS validate_whatsapp_session_phone ON public.whatsapp_sessions;
CREATE TRIGGER validate_whatsapp_session_phone
  BEFORE INSERT OR UPDATE ON public.whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_whatsapp_phone_number();

-- Apply same validation to auth codes
DROP TRIGGER IF EXISTS validate_whatsapp_auth_phone ON public.whatsapp_auth_codes;
CREATE TRIGGER validate_whatsapp_auth_phone
  BEFORE INSERT OR UPDATE ON public.whatsapp_auth_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_whatsapp_phone_number();