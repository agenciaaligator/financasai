-- Fase 1.1: Adicionar novos campos à tabela commitments
ALTER TABLE commitments 
ADD COLUMN location TEXT,
ADD COLUMN participants TEXT,
ADD COLUMN duration_minutes INTEGER DEFAULT 60,
ADD COLUMN notes TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN commitments.location IS 'Endereço ou local do compromisso';
COMMENT ON COLUMN commitments.participants IS 'Nomes dos participantes (separados por vírgula)';
COMMENT ON COLUMN commitments.duration_minutes IS 'Duração em minutos (padrão: 60min = 1h)';
COMMENT ON COLUMN commitments.notes IS 'Observações adicionais';

-- Fase 1.2: Criar tabela work_hours (Horário de Trabalho)
CREATE TABLE work_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

-- RLS Policies para work_hours
ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own work hours"
  ON work_hours FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own work hours"
  ON work_hours FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work hours"
  ON work_hours FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own work hours"
  ON work_hours FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_work_hours_updated_at
  BEFORE UPDATE ON work_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índice para performance
CREATE INDEX idx_work_hours_user_day ON work_hours(user_id, day_of_week);

-- Função para criar horário padrão (seg-sex, 8h-19h)
CREATE OR REPLACE FUNCTION create_default_work_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.work_hours (user_id, day_of_week, start_time, end_time)
  SELECT NEW.user_id, day, '08:00'::TIME, '19:00'::TIME
  FROM generate_series(1, 5) AS day
  ON CONFLICT (user_id, day_of_week) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger para criar work_hours ao criar perfil
CREATE TRIGGER on_profile_created_work_hours
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_work_hours();