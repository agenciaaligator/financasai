-- Create secure function to check WhatsApp auth status without exposing table
CREATE OR REPLACE FUNCTION public.is_whatsapp_authenticated()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  session_count int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO session_count
  FROM public.whatsapp_sessions
  WHERE user_id = uid AND expires_at > now();

  RETURN session_count > 0;
END;
$$;

-- Ensure execute permission for authenticated users (default PUBLIC can execute functions, but we restrict to authenticated)
REVOKE ALL ON FUNCTION public.is_whatsapp_authenticated() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_whatsapp_authenticated() TO authenticated;