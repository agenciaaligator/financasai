-- Security improvements for WhatsApp authentication codes
-- Update RLS policies to be more restrictive and secure

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage all auth codes" ON public.whatsapp_auth_codes;

-- Create more specific RLS policies for auth codes
CREATE POLICY "Service role can create auth codes"
  ON public.whatsapp_auth_codes
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can read auth codes"
  ON public.whatsapp_auth_codes
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update auth codes"
  ON public.whatsapp_auth_codes
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete auth codes"
  ON public.whatsapp_auth_codes
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Add index for better performance on cleanup queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_codes_expires_at ON public.whatsapp_auth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_codes_phone_code ON public.whatsapp_auth_codes(phone_number, code);

-- Security: Add rate limiting tracking table
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  phone_number TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on security events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Security events should only be accessible to service role
CREATE POLICY "Service role can manage security events"
  ON public.security_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Add indexes for security events
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_phone_number ON public.security_events(phone_number);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON public.security_events(event_type);

-- Add function to clean up old security events (keep only last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_security_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.security_events 
  WHERE created_at < now() - interval '30 days';
END;
$function$;