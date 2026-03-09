
-- Table for storing user category patterns (learning system)
CREATE TABLE public.user_category_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  keyword text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  confidence_score numeric DEFAULT 1,
  usage_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, keyword, category_id)
);

-- Enable RLS
ALTER TABLE public.user_category_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own patterns"
  ON public.user_category_patterns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own patterns"
  ON public.user_category_patterns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
  ON public.user_category_patterns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns"
  ON public.user_category_patterns FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role access for WhatsApp agent
CREATE POLICY "Service role can manage patterns"
  ON public.user_category_patterns FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER update_user_category_patterns_updated_at
  BEFORE UPDATE ON public.user_category_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast keyword lookup
CREATE INDEX idx_user_category_patterns_user_keyword 
  ON public.user_category_patterns(user_id, keyword);
