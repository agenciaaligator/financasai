-- Remove the problematic send_custom_email function that uses the non-existent net schema
DROP FUNCTION IF EXISTS public.send_custom_email(jsonb);

-- Disable the custom email webhook that was causing the signup failures
UPDATE auth.config 
SET hook_send_email_enabled = false,
    hook_send_email_url = NULL;