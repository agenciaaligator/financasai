
-- 1) Add franquia column to subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS limite_mensagens_mes integer;

-- Update premium plan: price + franquia
UPDATE public.subscription_plans
  SET price_monthly = 24.90,
      price_yearly = 239.00,
      limite_mensagens_mes = 1000,
      updated_at = now()
  WHERE name = 'premium';

-- 2) usage_mensagens table
CREATE TABLE IF NOT EXISTS public.usage_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ciclo_inicio date NOT NULL,
  ciclo_fim date NOT NULL,
  qtd_mensagens_cobradas integer NOT NULL DEFAULT 0,
  aviso_80_enviado boolean NOT NULL DEFAULT false,
  aviso_100_enviado boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ciclo_inicio)
);

CREATE INDEX IF NOT EXISTS usage_mensagens_user_ciclo_idx
  ON public.usage_mensagens (user_id, ciclo_inicio DESC);

GRANT SELECT ON public.usage_mensagens TO authenticated;
GRANT ALL ON public.usage_mensagens TO service_role;

ALTER TABLE public.usage_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_mensagens_owner_select"
  ON public.usage_mensagens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "usage_mensagens_admin_select"
  ON public.usage_mensagens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) whatsapp_cost_config singleton
CREATE TABLE IF NOT EXISTS public.whatsapp_cost_config (
  id integer NOT NULL PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  custo_por_mensagem_brl numeric(10,4) NOT NULL DEFAULT 0.05,
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.whatsapp_cost_config (id, custo_por_mensagem_brl)
  VALUES (1, 0.05)
  ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.whatsapp_cost_config TO authenticated;
GRANT ALL ON public.whatsapp_cost_config TO service_role;

ALTER TABLE public.whatsapp_cost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_cost_config_read_all"
  ON public.whatsapp_cost_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "whatsapp_cost_config_admin_update"
  ON public.whatsapp_cost_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Helper: resolve current billing cycle for a user (fallback to calendar month)
CREATE OR REPLACE FUNCTION public.get_current_billing_cycle(p_user_id uuid)
RETURNS TABLE (ciclo_inicio date, ciclo_fim date)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end date;
BEGIN
  SELECT current_period_start::date, current_period_end::date
    INTO v_start, v_end
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing', 'past_due')
    AND current_period_start IS NOT NULL
    AND current_period_end IS NOT NULL
  ORDER BY current_period_end DESC NULLS LAST
  LIMIT 1;

  IF v_start IS NULL THEN
    v_start := date_trunc('month', now())::date;
    v_end := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
  END IF;

  RETURN QUERY SELECT v_start, v_end;
END;
$$;

-- 5) increment_usage_mensagens
CREATE OR REPLACE FUNCTION public.increment_usage_mensagens(p_user_id uuid, p_qtd integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle record;
  v_limit integer;
  v_qtd integer;
  v_pct numeric;
  v_estado text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT * INTO v_cycle FROM public.get_current_billing_cycle(p_user_id);

  SELECT sp.limite_mensagens_mes INTO v_limit
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active','trialing','past_due')
  ORDER BY us.current_period_end DESC NULLS LAST
  LIMIT 1;

  INSERT INTO public.usage_mensagens (user_id, ciclo_inicio, ciclo_fim, qtd_mensagens_cobradas, atualizado_em)
  VALUES (p_user_id, v_cycle.ciclo_inicio, v_cycle.ciclo_fim, GREATEST(p_qtd,0), now())
  ON CONFLICT (user_id, ciclo_inicio) DO UPDATE
    SET qtd_mensagens_cobradas = public.usage_mensagens.qtd_mensagens_cobradas + GREATEST(p_qtd,0),
        atualizado_em = now()
  RETURNING qtd_mensagens_cobradas INTO v_qtd;

  IF v_limit IS NULL OR v_limit = 0 THEN
    v_pct := 0;
    v_estado := 'ok';
  ELSE
    v_pct := round((v_qtd::numeric / v_limit::numeric) * 100, 2);
    v_estado := CASE
      WHEN v_pct >= 120 THEN 'blocked'
      WHEN v_pct >= 100 THEN 'over'
      WHEN v_pct >= 80 THEN 'warning'
      ELSE 'ok'
    END;
  END IF;

  RETURN jsonb_build_object(
    'qtd_atual', v_qtd,
    'limite', v_limit,
    'percentual', v_pct,
    'estado', v_estado,
    'ciclo_inicio', v_cycle.ciclo_inicio,
    'ciclo_fim', v_cycle.ciclo_fim,
    'bloqueado', v_estado = 'blocked'
  );
END;
$$;

-- 6) get_usage_status
CREATE OR REPLACE FUNCTION public.get_usage_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle record;
  v_limit integer;
  v_qtd integer;
  v_pct numeric;
  v_estado text;
BEGIN
  SELECT * INTO v_cycle FROM public.get_current_billing_cycle(p_user_id);

  SELECT sp.limite_mensagens_mes INTO v_limit
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active','trialing','past_due')
  ORDER BY us.current_period_end DESC NULLS LAST
  LIMIT 1;

  SELECT COALESCE(qtd_mensagens_cobradas, 0) INTO v_qtd
  FROM public.usage_mensagens
  WHERE user_id = p_user_id AND ciclo_inicio = v_cycle.ciclo_inicio;

  v_qtd := COALESCE(v_qtd, 0);

  IF v_limit IS NULL OR v_limit = 0 THEN
    v_pct := 0;
    v_estado := 'ok';
  ELSE
    v_pct := round((v_qtd::numeric / v_limit::numeric) * 100, 2);
    v_estado := CASE
      WHEN v_pct >= 120 THEN 'blocked'
      WHEN v_pct >= 100 THEN 'over'
      WHEN v_pct >= 80 THEN 'warning'
      ELSE 'ok'
    END;
  END IF;

  RETURN jsonb_build_object(
    'qtd_atual', v_qtd,
    'limite', v_limit,
    'percentual', v_pct,
    'estado', v_estado,
    'ciclo_inicio', v_cycle.ciclo_inicio,
    'ciclo_fim', v_cycle.ciclo_fim,
    'bloqueado', v_estado = 'blocked'
  );
END;
$$;

-- 7) updated trigger
CREATE OR REPLACE FUNCTION public.update_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usage_mensagens_updated ON public.usage_mensagens;
CREATE TRIGGER trg_usage_mensagens_updated
  BEFORE UPDATE ON public.usage_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

DROP TRIGGER IF EXISTS trg_whatsapp_cost_config_updated ON public.whatsapp_cost_config;
CREATE TRIGGER trg_whatsapp_cost_config_updated
  BEFORE UPDATE ON public.whatsapp_cost_config
  FOR EACH ROW EXECUTE FUNCTION public.update_atualizado_em();

-- 8) Realtime for usage_mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.usage_mensagens;
