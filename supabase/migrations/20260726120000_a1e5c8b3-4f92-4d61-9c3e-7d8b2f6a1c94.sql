-- Programa de afiliados: comissao unica no primeiro pagamento, aprovacao manual,
-- pagamento manual via Pix (o sistema so calcula e marca como pago).

CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  pix_key TEXT,
  commission_type TEXT NOT NULL DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percent')),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL,
  referred_email TEXT,
  plan_name TEXT,
  amount_paid NUMERIC,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  -- Garante que cada usuario so gera comissao uma vez (comissao e so no 1o pagamento)
  UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate ON public.affiliate_referrals(affiliate_id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages affiliates" ON public.affiliates;
CREATE POLICY "Admin manages affiliates"
ON public.affiliates
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master_user(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master_user(auth.uid()));

DROP POLICY IF EXISTS "Admin manages affiliate referrals" ON public.affiliate_referrals;
CREATE POLICY "Admin manages affiliate referrals"
ON public.affiliate_referrals
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master_user(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master_user(auth.uid()));

-- service_role (usado no stripe-webhook) ignora RLS automaticamente.
