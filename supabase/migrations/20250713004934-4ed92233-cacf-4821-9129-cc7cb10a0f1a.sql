-- Security fixes to resolve Supabase Security Advisor warnings

-- 1. Fix functions with mutable search path by recreating them with SET search_path = ''
CREATE OR REPLACE FUNCTION public.clean_duplicate_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Remove perfis duplicados mantendo apenas o mais recente
  DELETE FROM public.profiles 
  WHERE id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM public.profiles
    ORDER BY user_id, created_at DESC
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Remove the HTTP extension from public schema since we're not using custom emails anymore
DROP EXTENSION IF EXISTS http;

-- 3. Drop unused functions that depend on HTTP extension
DROP FUNCTION IF EXISTS public.send_custom_email(jsonb);
DROP FUNCTION IF EXISTS public.http_set_curlopt(character varying, character varying);
DROP FUNCTION IF EXISTS public.http_reset_curlopt();
DROP FUNCTION IF EXISTS public.http_list_curlopt();
DROP FUNCTION IF EXISTS public.http_header(character varying, character varying);
DROP FUNCTION IF EXISTS public.http(http_request);
DROP FUNCTION IF EXISTS public.http_get(character varying);
DROP FUNCTION IF EXISTS public.http_post(character varying, character varying, character varying);
DROP FUNCTION IF EXISTS public.http_put(character varying, character varying, character varying);
DROP FUNCTION IF EXISTS public.http_patch(character varying, character varying, character varying);
DROP FUNCTION IF EXISTS public.http_delete(character varying);
DROP FUNCTION IF EXISTS public.http_delete(character varying, character varying, character varying);
DROP FUNCTION IF EXISTS public.http_head(character varying);
DROP FUNCTION IF EXISTS public.urlencode(character varying);
DROP FUNCTION IF EXISTS public.urlencode(bytea);
DROP FUNCTION IF EXISTS public.urlencode(jsonb);
DROP FUNCTION IF EXISTS public.http_get(character varying, jsonb);
DROP FUNCTION IF EXISTS public.http_post(character varying, jsonb);
DROP FUNCTION IF EXISTS public.text_to_bytea(text);
DROP FUNCTION IF EXISTS public.bytea_to_text(bytea);

-- 4. Drop composite types related to HTTP extension
DROP TYPE IF EXISTS public.http_header;
DROP TYPE IF EXISTS public.http_request;
DROP TYPE IF EXISTS public.http_response;

-- 5. Clean up unused functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.create_default_categories();