-- Criar tabela de eventos para o módulo Agenda
CREATE TABLE IF NOT EXISTS public.eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

-- Policies for eventos
CREATE POLICY "Users can view their own eventos"
ON public.eventos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own eventos"
ON public.eventos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own eventos"
ON public.eventos
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own eventos"
ON public.eventos
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_eventos_updated_at
BEFORE UPDATE ON public.eventos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();