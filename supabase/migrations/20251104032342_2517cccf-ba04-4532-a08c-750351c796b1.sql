-- =====================================================
-- FASE 1: Sistema de Contas Recorrentes (Contas Fixas)
-- =====================================================

-- Tabela principal de transações recorrentes
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'yearly', 'custom')),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  interval_days INTEGER CHECK (interval_days > 0),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  reminders JSONB DEFAULT '[1440, 60]'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de instâncias (cada cobrança individual)
CREATE TABLE IF NOT EXISTS public.recurring_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_transaction_id UUID NOT NULL REFERENCES public.recurring_transactions(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'paid', 'overdue')),
  paid_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_recurring_transactions_user ON public.recurring_transactions(user_id);
CREATE INDEX idx_recurring_transactions_org ON public.recurring_transactions(organization_id);
CREATE INDEX idx_recurring_transactions_active ON public.recurring_transactions(is_active) WHERE is_active = true;
CREATE INDEX idx_recurring_instances_recurring ON public.recurring_instances(recurring_transaction_id);
CREATE INDEX idx_recurring_instances_due_date ON public.recurring_instances(due_date);
CREATE INDEX idx_recurring_instances_status ON public.recurring_instances(status);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_recurring_transactions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_recurring_transactions_updated_at
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recurring_transactions_updated_at();

CREATE OR REPLACE FUNCTION public.update_recurring_instances_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_recurring_instances_updated_at
  BEFORE UPDATE ON public.recurring_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_recurring_instances_updated_at();

-- RLS Policies para recurring_transactions
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring transactions"
  ON public.recurring_transactions FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Users can create own recurring transactions"
  ON public.recurring_transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id))
  );

CREATE POLICY "Users can update own recurring transactions"
  ON public.recurring_transactions FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR (organization_id IS NOT NULL AND has_org_permission(auth.uid(), organization_id, 'edit_others'))
  );

CREATE POLICY "Users can delete own recurring transactions"
  ON public.recurring_transactions FOR DELETE
  USING (
    auth.uid() = user_id 
    OR (organization_id IS NOT NULL AND has_org_permission(auth.uid(), organization_id, 'delete_others'))
  );

-- RLS Policies para recurring_instances
ALTER TABLE public.recurring_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring instances"
  ON public.recurring_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_transactions rt
      WHERE rt.id = recurring_instances.recurring_transaction_id
        AND (
          rt.user_id = auth.uid()
          OR (rt.organization_id IS NOT NULL AND is_org_member(auth.uid(), rt.organization_id))
        )
    )
  );

CREATE POLICY "Users can create recurring instances"
  ON public.recurring_instances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recurring_transactions rt
      WHERE rt.id = recurring_instances.recurring_transaction_id
        AND rt.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own recurring instances"
  ON public.recurring_instances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_transactions rt
      WHERE rt.id = recurring_instances.recurring_transaction_id
        AND (
          rt.user_id = auth.uid()
          OR (rt.organization_id IS NOT NULL AND has_org_permission(auth.uid(), rt.organization_id, 'edit_others'))
        )
    )
  );

CREATE POLICY "Users can delete recurring instances"
  ON public.recurring_instances FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_transactions rt
      WHERE rt.id = recurring_instances.recurring_transaction_id
        AND (
          rt.user_id = auth.uid()
          OR (rt.organization_id IS NOT NULL AND has_org_permission(auth.uid(), rt.organization_id, 'delete_others'))
        )
    )
  );