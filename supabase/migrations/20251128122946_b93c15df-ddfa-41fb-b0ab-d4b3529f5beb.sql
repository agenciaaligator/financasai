-- Criar RPC para buscar informações da sessão WhatsApp (bypassar RLS)
CREATE OR REPLACE FUNCTION public.get_whatsapp_session_info(p_user_id uuid)
RETURNS TABLE(last_activity timestamptz, expires_at timestamptz, phone_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ws.last_activity, ws.expires_at, ws.phone_number
  FROM public.whatsapp_sessions ws
  WHERE ws.user_id = p_user_id AND ws.expires_at > now()
  LIMIT 1;
END;
$$;