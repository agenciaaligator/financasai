-- Add missing DELETE policy for profiles table
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Add rate limiting table for enhanced security
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  event_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Only service role can manage rate limit events
CREATE POLICY "Service role can manage rate limit events"
ON public.rate_limit_events
FOR ALL
USING (auth.role() = 'service_role');

-- Add index for cleanup queries
CREATE INDEX idx_rate_limit_events_created_at ON public.rate_limit_events(created_at);

-- Function to cleanup old rate limit events
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_events 
  WHERE created_at < now() - interval '1 hour';
END;
$$;