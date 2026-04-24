ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.validate_contact_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recent_count int;
  duplicate_count int;
BEGIN
  NEW.name := trim(NEW.name);
  NEW.email := lower(trim(NEW.email));
  NEW.subject := trim(NEW.subject);
  NEW.message := trim(NEW.message);

  -- Phone: trim, normalize empty to NULL, validate when present
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := trim(NEW.phone);
    IF NEW.phone = '' THEN
      NEW.phone := NULL;
    ELSE
      IF length(NEW.phone) < 8 OR length(NEW.phone) > 20 THEN
        RAISE EXCEPTION 'validation:phone_invalid' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.phone !~ '^[0-9 +()\-]+$' THEN
        RAISE EXCEPTION 'validation:phone_invalid' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF length(NEW.name) < 2 THEN
    RAISE EXCEPTION 'validation:name_min' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.subject) < 3 THEN
    RAISE EXCEPTION 'validation:subject_min' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.message) < 10 THEN
    RAISE EXCEPTION 'validation:message_min' USING ERRCODE = 'check_violation';
  END IF;

  IF length(NEW.name) > 120 THEN
    RAISE EXCEPTION 'validation:name_max' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'validation:email_max' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.subject) > 200 THEN
    RAISE EXCEPTION 'validation:subject_max' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.message) > 5000 THEN
    RAISE EXCEPTION 'validation:message_max' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'validation:email_invalid' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.ip_address IS NOT NULL THEN
    SELECT count(*) INTO recent_count
    FROM public.contact_messages
    WHERE ip_address = NEW.ip_address
      AND created_at > now() - interval '10 minutes';
    IF recent_count >= 3 THEN
      RAISE EXCEPTION 'ratelimit:too_many' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  SELECT count(*) INTO duplicate_count
  FROM public.contact_messages
  WHERE email = NEW.email
    AND subject = NEW.subject
    AND message = NEW.message
    AND created_at > now() - interval '60 minutes';
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'duplicate:already_sent' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;