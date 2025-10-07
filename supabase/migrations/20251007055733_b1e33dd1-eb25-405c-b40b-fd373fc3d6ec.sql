-- Criar tabela de compromissos
CREATE TABLE public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_sent BOOLEAN DEFAULT false,
  google_event_id TEXT,
  category TEXT CHECK (category IN ('meeting', 'appointment', 'payment', 'other')) DEFAULT 'other',
  linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own commitments"
  ON public.commitments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own commitments"
  ON public.commitments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commitments"
  ON public.commitments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own commitments"
  ON public.commitments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_commitments_updated_at
  BEFORE UPDATE ON public.commitments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_commitments_user_id ON public.commitments(user_id);
CREATE INDEX idx_commitments_scheduled_at ON public.commitments(scheduled_at);
CREATE INDEX idx_commitments_reminder_sent ON public.commitments(reminder_sent, scheduled_at);