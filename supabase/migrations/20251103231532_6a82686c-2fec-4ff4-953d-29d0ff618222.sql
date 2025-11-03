-- Add organization_id to whatsapp_sessions to track which org the WhatsApp is linked to
ALTER TABLE public.whatsapp_sessions 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_sessions_organization_id ON public.whatsapp_sessions(organization_id);

-- Create index for active session lookups (without WHERE clause to avoid immutable function issue)
CREATE INDEX idx_whatsapp_sessions_user_expires ON public.whatsapp_sessions(user_id, expires_at);