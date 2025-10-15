-- Remover conexões duplicadas existentes (mantém apenas a mais recente por user_id+provider)
DELETE FROM public.calendar_connections 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, provider) id
  FROM public.calendar_connections
  ORDER BY user_id, provider, created_at DESC
);

-- Criar constraint UNIQUE para permitir upsert
ALTER TABLE public.calendar_connections
ADD CONSTRAINT calendar_connections_user_provider_unique 
UNIQUE (user_id, provider);