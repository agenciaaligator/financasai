
-- Create monthly_goals table
CREATE TABLE public.monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category_id)
);

-- Enable RLS
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own goals"
  ON public.monthly_goals FOR SELECT
  TO public
  USING (auth.uid() = user_id OR (organization_id IS NOT NULL AND is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can create own goals"
  ON public.monthly_goals FOR INSERT
  TO public
  WITH CHECK (auth.uid() = user_id AND (organization_id IS NULL OR is_org_member(auth.uid(), organization_id)));

CREATE POLICY "Users can update own goals"
  ON public.monthly_goals FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON public.monthly_goals FOR DELETE
  TO public
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_monthly_goals_updated_at
  BEFORE UPDATE ON public.monthly_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
