
-- Revoke anon EXECUTE from SECURITY DEFINER functions that must only be called by authenticated users
REVOKE EXECUTE ON FUNCTION public.accept_organization_invite(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_whatsapp_session_info(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_whatsapp_authenticated_for_user(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_whatsapp_authenticated() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_commitments_safe(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_member_profiles(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_plan_limits(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_active_plan(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_usage_status(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_permission(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_master_user(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_manager(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon, PUBLIC;

-- Server-only helpers: revoke from both anon and authenticated (only service_role should call)
REVOKE EXECUTE ON FUNCTION public.get_current_billing_cycle(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_usage_mensagens(uuid, integer) FROM anon, authenticated, PUBLIC;
