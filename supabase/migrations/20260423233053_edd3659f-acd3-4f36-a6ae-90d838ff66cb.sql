-- Tabela de mensagens de contato
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  replied_at timestamptz,
  archived_at timestamptz,
  ip_address text,
  user_agent text,
  CONSTRAINT contact_messages_status_check CHECK (status IN ('new', 'read', 'replied', 'archived'))
);

CREATE INDEX idx_contact_messages_created_at ON public.contact_messages (created_at DESC);
CREATE INDEX idx_contact_messages_status ON public.contact_messages (status);
CREATE INDEX idx_contact_messages_email ON public.contact_messages (email);
CREATE INDEX idx_contact_messages_ip_created ON public.contact_messages (ip_address, created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode INSERIR (formulário público)
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Apenas admins/masters podem ver
CREATE POLICY "Admins and masters can view contact messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

-- Apenas admins/masters podem atualizar
CREATE POLICY "Admins and masters can update contact messages"
ON public.contact_messages
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

-- Apenas admins/masters podem deletar
CREATE POLICY "Admins and masters can delete contact messages"
ON public.contact_messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master_user(auth.uid()));

-- Trigger de validação + anti-spam
CREATE OR REPLACE FUNCTION public.validate_contact_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  duplicate_count int;
BEGIN
  -- Trim básico
  NEW.name := trim(NEW.name);
  NEW.email := lower(trim(NEW.email));
  NEW.subject := trim(NEW.subject);
  NEW.message := trim(NEW.message);

  -- Tamanhos mínimos
  IF length(NEW.name) < 2 THEN
    RAISE EXCEPTION 'validation:name_min' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.subject) < 3 THEN
    RAISE EXCEPTION 'validation:subject_min' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.message) < 10 THEN
    RAISE EXCEPTION 'validation:message_min' USING ERRCODE = 'check_violation';
  END IF;

  -- Tamanhos máximos
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

  -- Email válido
  IF NEW.email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'validation:email_invalid' USING ERRCODE = 'check_violation';
  END IF;

  -- Rate limit por IP: max 3 em 10 min
  IF NEW.ip_address IS NOT NULL THEN
    SELECT count(*) INTO recent_count
    FROM public.contact_messages
    WHERE ip_address = NEW.ip_address
      AND created_at > now() - interval '10 minutes';
    IF recent_count >= 3 THEN
      RAISE EXCEPTION 'ratelimit:too_many' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Anti-duplicata: mesma combinação email+subject+message nos últimos 60min
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
$$;

CREATE TRIGGER contact_messages_validate
BEFORE INSERT ON public.contact_messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_contact_message();