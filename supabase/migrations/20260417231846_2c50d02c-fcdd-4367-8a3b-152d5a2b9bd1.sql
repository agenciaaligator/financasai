-- Remover duplicatas existentes (manter a mais recente por user_id)
DELETE FROM public.whatsapp_sessions a
USING public.whatsapp_sessions b
WHERE a.user_id = b.user_id
  AND a.user_id IS NOT NULL
  AND a.created_at < b.created_at;

-- Criar constraint UNIQUE em user_id para suportar ON CONFLICT
ALTER TABLE public.whatsapp_sessions
  ADD CONSTRAINT whatsapp_sessions_user_id_key UNIQUE (user_id);