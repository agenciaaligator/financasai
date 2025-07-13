-- Disable the email webhook that's causing signup failures
UPDATE auth.config 
SET hook_send_email_enabled = false,
    hook_send_email_url = NULL
WHERE true;