-- Criar tabela para sessões do WhatsApp
CREATE TABLE public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data JSONB DEFAULT '{}'::jsonb,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours')
);

-- Criar índices para performance
CREATE INDEX idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone_number);
CREATE INDEX idx_whatsapp_sessions_user_id ON public.whatsapp_sessions(user_id);
CREATE INDEX idx_whatsapp_sessions_expires_at ON public.whatsapp_sessions(expires_at);

-- Criar tabela para códigos de autenticação
CREATE TABLE public.whatsapp_auth_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '10 minutes')
);

-- Criar índices
CREATE INDEX idx_whatsapp_auth_codes_phone ON public.whatsapp_auth_codes(phone_number);
CREATE INDEX idx_whatsapp_auth_codes_code ON public.whatsapp_auth_codes(code);
CREATE INDEX idx_whatsapp_auth_codes_expires_at ON public.whatsapp_auth_codes(expires_at);

-- Habilitar RLS
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_auth_codes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para whatsapp_sessions
CREATE POLICY "Service role can manage all sessions" 
ON public.whatsapp_sessions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Políticas RLS para whatsapp_auth_codes
CREATE POLICY "Service role can manage all auth codes" 
ON public.whatsapp_auth_codes 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION public.cleanup_expired_whatsapp_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Limpar sessões expiradas
  DELETE FROM public.whatsapp_sessions 
  WHERE expires_at < now();
  
  -- Limpar códigos expirados
  DELETE FROM public.whatsapp_auth_codes 
  WHERE expires_at < now();
END;
$$;