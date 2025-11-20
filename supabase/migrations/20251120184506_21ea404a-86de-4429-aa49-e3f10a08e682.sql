-- Permitir que usuários anônimos vejam planos ativos na landing page
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;

CREATE POLICY "Anyone can view active plans" ON public.subscription_plans
FOR SELECT 
TO authenticated, anon
USING (is_active = true);