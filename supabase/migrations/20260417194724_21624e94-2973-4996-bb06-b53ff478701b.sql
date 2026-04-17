-- Fix 1: Remove user SELECT access to whatsapp_validation_codes (OTP codes should never be readable by clients)
DROP POLICY IF EXISTS "Users can view own validation codes" ON public.whatsapp_validation_codes;

-- Fix 2: Allow org managers to DELETE invitations (cleanup expired/revoked)
CREATE POLICY "Managers can delete invites"
ON public.organization_invitations
FOR DELETE
USING (is_org_manager(auth.uid(), organization_id));