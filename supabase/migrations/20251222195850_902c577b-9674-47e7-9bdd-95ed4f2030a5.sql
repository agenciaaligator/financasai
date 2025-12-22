-- Atualizar todas as sessões existentes para expirar em 10 anos (sessões permanentes)
UPDATE whatsapp_sessions 
SET expires_at = NOW() + INTERVAL '10 years'
WHERE expires_at < NOW() + INTERVAL '10 years';

-- Criar função RPC atualizada que ignora expiração
CREATE OR REPLACE FUNCTION public.is_whatsapp_authenticated_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_count int;
BEGIN
  -- SESSÕES PERMANENTES: Não verificar expires_at
  SELECT COUNT(*) INTO session_count
  FROM public.whatsapp_sessions
  WHERE user_id = p_user_id;

  RETURN session_count > 0;
END;
$function$;

-- Atualizar também a função is_whatsapp_authenticated
CREATE OR REPLACE FUNCTION public.is_whatsapp_authenticated()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  session_count int;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  -- SESSÕES PERMANENTES: Não verificar expires_at
  SELECT COUNT(*) INTO session_count
  FROM public.whatsapp_sessions
  WHERE user_id = uid;

  RETURN session_count > 0;
END;
$function$;

-- Atualizar get_whatsapp_session_info para não verificar expiração
CREATE OR REPLACE FUNCTION public.get_whatsapp_session_info(p_user_id uuid)
RETURNS TABLE(last_activity timestamp with time zone, expires_at timestamp with time zone, phone_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- SESSÕES PERMANENTES: Não verificar expires_at
  RETURN QUERY
  SELECT ws.last_activity, ws.expires_at, ws.phone_number
  FROM public.whatsapp_sessions ws
  WHERE ws.user_id = p_user_id
  LIMIT 1;
END;
$function$;