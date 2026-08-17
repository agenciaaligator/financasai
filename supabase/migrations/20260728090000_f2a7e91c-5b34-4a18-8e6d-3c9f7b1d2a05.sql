-- Permite comissao diferente para plano mensal vs anual.
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS commission_value_monthly NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_value_yearly NUMERIC;

-- Migra afiliados existentes: usa o valor antigo como ponto de partida nos dois.
UPDATE public.affiliates
SET commission_value_monthly = COALESCE(commission_value_monthly, commission_value),
    commission_value_yearly = COALESCE(commission_value_yearly, commission_value)
WHERE commission_value_monthly IS NULL OR commission_value_yearly IS NULL;

ALTER TABLE public.affiliates
  ALTER COLUMN commission_value_monthly SET DEFAULT 0,
  ALTER COLUMN commission_value_yearly SET DEFAULT 0,
  ALTER COLUMN commission_value_monthly SET NOT NULL,
  ALTER COLUMN commission_value_yearly SET NOT NULL;

ALTER TABLE public.affiliates DROP COLUMN IF EXISTS commission_value;
