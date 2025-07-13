-- Remove the problematic send_custom_email function that uses the non-existent net schema
DROP FUNCTION IF EXISTS public.send_custom_email(jsonb);