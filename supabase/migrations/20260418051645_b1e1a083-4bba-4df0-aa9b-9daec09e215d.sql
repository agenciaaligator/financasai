-- 1. Unique partial index on phone_number (case data already clean)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_number_unique
ON public.profiles (phone_number)
WHERE phone_number IS NOT NULL;

-- 2. RPC: check_email_available
CREATE OR REPLACE FUNCTION public.check_email_available(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email))
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_email_available(text) TO anon, authenticated;

-- 3. RPC: check_phone_available (normalizes by stripping non-digits)
CREATE OR REPLACE FUNCTION public.check_phone_available(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone_number IS NOT NULL
      AND regexp_replace(phone_number, '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g')
      AND regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g') <> ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_available(text) TO anon, authenticated;

-- 4. Harden handle_new_user_simple: never let a phone duplicate (or org issue)
--    block auth.users creation. Profile/org creation is best-effort; failures
--    are swallowed so the signup itself succeeds (frontend pre-check guards UX).
CREATE OR REPLACE FUNCTION public.handle_new_user_simple()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  org_id uuid;
  user_name text;
  user_phone text;
  user_password_set boolean;
BEGIN
  user_name := COALESCE(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));
  user_phone := new.raw_user_meta_data ->> 'phone_number';
  user_password_set := COALESCE((new.raw_user_meta_data ->> 'password_set')::boolean, false);

  BEGIN
    INSERT INTO public.profiles (user_id, full_name, email, phone_number, password_set)
    VALUES (new.id, user_name, new.email, user_phone, user_password_set)
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = EXCLUDED.email,
      phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number),
      password_set = GREATEST(public.profiles.password_set, EXCLUDED.password_set);
  EXCEPTION
    WHEN unique_violation THEN
      -- Likely phone_number duplicate. Insert profile WITHOUT phone so signup doesn't break.
      INSERT INTO public.profiles (user_id, full_name, email, phone_number, password_set)
      VALUES (new.id, user_name, new.email, NULL, user_password_set)
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        email = EXCLUDED.email,
        password_set = GREATEST(public.profiles.password_set, EXCLUDED.password_set);

      INSERT INTO public.security_events (event_type, phone_number, details)
      VALUES ('signup_phone_duplicate_dropped', user_phone, jsonb_build_object('user_id', new.id, 'email', new.email));
    WHEN OTHERS THEN
      INSERT INTO public.security_events (event_type, details)
      VALUES ('signup_profile_insert_failed', jsonb_build_object('user_id', new.id, 'error', SQLERRM));
  END;

  BEGIN
    INSERT INTO public.organizations (owner_id, name)
    VALUES (new.id, user_name || ' - Organização')
    RETURNING id INTO org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role, permissions)
    VALUES (
      org_id,
      new.id,
      'owner',
      '{"view": true, "create": true, "edit": true, "delete": true}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.security_events (event_type, details)
    VALUES ('signup_org_create_failed', jsonb_build_object('user_id', new.id, 'error', SQLERRM));
  END;

  RETURN new;
END;
$function$;