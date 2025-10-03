-- Criar tabela de votos em funcionalidades
CREATE TABLE IF NOT EXISTS public.feature_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, feature_id)
);

-- Criar tabela de sugestões de funcionalidades
CREATE TABLE IF NOT EXISTS public.feature_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  votes integer DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feature_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

-- Políticas para feature_votes
CREATE POLICY "Usuários podem criar seus próprios votos"
  ON public.feature_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem ver seus próprios votos"
  ON public.feature_votes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios votos"
  ON public.feature_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Políticas para feature_suggestions
CREATE POLICY "Usuários podem criar sugestões"
  ON public.feature_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Todos podem ver sugestões"
  ON public.feature_suggestions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem atualizar suas próprias sugestões"
  ON public.feature_suggestions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);