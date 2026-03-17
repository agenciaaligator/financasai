
-- Tabela para rastrear alertas de metas já enviados (evitar duplicatas)
CREATE TABLE public.goal_alerts_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  goal_id uuid NOT NULL REFERENCES public.monthly_goals(id) ON DELETE CASCADE,
  month text NOT NULL, -- formato YYYY-MM
  threshold integer NOT NULL, -- 70, 90 ou 100
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (goal_id, month, threshold)
);

-- Enable RLS
ALTER TABLE public.goal_alerts_sent ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own goal alerts"
ON public.goal_alerts_sent FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage goal alerts"
ON public.goal_alerts_sent FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Index for fast lookups
CREATE INDEX idx_goal_alerts_sent_lookup ON public.goal_alerts_sent (goal_id, month, threshold);
CREATE INDEX idx_goal_alerts_sent_user ON public.goal_alerts_sent (user_id);
