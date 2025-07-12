-- Configure custom webhook for sending emails via our Resend edge function
UPDATE auth.config 
SET hook_send_email_enabled = true,
    hook_send_email_url = 'https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/custom-auth-emails';