
-- 1. Fix ownership check on WhatsApp session helpers
CREATE OR REPLACE FUNCTION public.get_whatsapp_session_info(p_user_id uuid)
RETURNS TABLE(last_activity timestamp with time zone, expires_at timestamp with time zone, phone_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT ws.last_activity, ws.expires_at, ws.phone_number
  FROM public.whatsapp_sessions ws
  WHERE ws.user_id = p_user_id
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_whatsapp_authenticated_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_count int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT COUNT(*) INTO session_count
  FROM public.whatsapp_sessions
  WHERE user_id = p_user_id;
  RETURN session_count > 0;
END;
$function$;

-- 2. Set immutable search_path on remaining SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_token uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_invitation record;
  v_user_email text;
begin
  select * into v_invitation from public.organization_invitations
  where token = p_token and status = 'pending' and expires_at > now();

  if not found then
    return jsonb_build_object('success', false, 'error', 'Convite inválido ou expirado');
  end if;

  select email into v_user_email from public.profiles where user_id = p_user_id;

  if v_user_email != v_invitation.email then
    return jsonb_build_object('success', false, 'error', 'Este convite não é para o seu email');
  end if;

  if exists (select 1 from public.organization_members where organization_id = v_invitation.organization_id and user_id = p_user_id) then
    update public.organization_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;
    return jsonb_build_object('success', true, 'message', 'Você já é membro desta organização');
  end if;

  insert into public.organization_members (organization_id, user_id, role, permissions)
  values (v_invitation.organization_id, p_user_id, v_invitation.role, v_invitation.permissions);

  update public.organization_invitations set status = 'accepted', accepted_at = now() where id = v_invitation.id;

  return jsonb_build_object('success', true, 'message', 'Convite aceito com sucesso!');
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_org_manager(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  return exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and role in ('owner', 'admin')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_cron_jobs_status()
RETURNS TABLE(jobname text, schedule text, active boolean, last_run timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public','cron'
AS $function$
  SELECT
    j.jobname,
    j.schedule,
    j.active,
    r.end_time as last_run
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT end_time
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY end_time DESC
    LIMIT 1
  ) r ON true
  WHERE j.jobname IN (
    'send-commitment-reminders-5min',
    'send-daily-agenda-8am',
    'sync-all-google-calendars-10min'
  );
$function$;

-- 3. Revoke EXECUTE on trigger-only SECURITY DEFINER functions from anon/authenticated
-- These run internally via triggers and should not be callable via the API.
DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'create_default_categories()',
    'handle_new_user_simple()',
    'validate_profile_phone_number()',
    'create_default_work_hours()',
    'update_recurring_transactions_updated_at()',
    'update_calendar_connections_updated_at()',
    'update_invitations_updated_at()',
    'update_organizations_updated_at()',
    'update_recurring_instances_updated_at()',
    'update_subscription_plans_updated_at()',
    'update_updated_at_column()',
    'update_user_roles_updated_at()',
    'update_user_subscriptions_updated_at()',
    'validate_subscription_not_free()',
    'validate_whatsapp_phone_number()',
    'validate_contact_message()',
    'update_atualizado_em()',
    'handle_new_user_role()',
    'clean_duplicate_profiles()',
    'cleanup_expired_validation_codes()',
    'cleanup_expired_whatsapp_data()',
    'cleanup_old_security_events()',
    'cleanup_rate_limit_events()',
    'backfill_transactions_org(uuid)',
    'check_user_exists(text)',
    'get_cron_jobs_status()'
  ])
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn);
    EXCEPTION WHEN OTHERS THEN
      -- ignore missing functions or already revoked
      NULL;
    END;
  END LOOP;
END $$;

-- 4. Tighten contact_messages INSERT policy (validation trigger still runs, but replace WITH CHECK true)
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  name IS NOT NULL
  AND email IS NOT NULL
  AND subject IS NOT NULL
  AND message IS NOT NULL
  AND length(name) BETWEEN 2 AND 120
  AND length(email) BETWEEN 5 AND 255
  AND length(subject) BETWEEN 3 AND 200
  AND length(message) BETWEEN 10 AND 5000
);

-- 5. Disable pg_graphql — this app uses PostgREST, not GraphQL. Removes the mass exposure findings.
DROP EXTENSION IF EXISTS pg_graphql CASCADE;
