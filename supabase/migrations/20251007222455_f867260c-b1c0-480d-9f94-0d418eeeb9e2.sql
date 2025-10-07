-- FASE 1: Data Cleanup - Remover assinatura 'free' inválida e corrigir dados

-- 1.1 Deletar assinatura com plano 'free' (não deveria existir)
DELETE FROM public.user_subscriptions 
WHERE plan_id IN (SELECT id FROM public.subscription_plans WHERE name = 'free');

-- 1.2 Garantir email correto em profiles para o master user
UPDATE public.profiles 
SET email = 'contato@aligator.com.br'
WHERE user_id IN (SELECT user_id FROM public.master_users)
  AND (email IS NULL OR email != 'contato@aligator.com.br');

-- 1.3 Criar função para validar que subscription não seja de plano 'free'
CREATE OR REPLACE FUNCTION public.validate_subscription_not_free()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_name_check text;
BEGIN
  -- Buscar o nome do plano
  SELECT name INTO plan_name_check
  FROM public.subscription_plans
  WHERE id = NEW.plan_id;
  
  -- Se for plano 'free', rejeitar
  IF plan_name_check = 'free' THEN
    RAISE EXCEPTION 'Cannot create subscription with free plan';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 1.4 Criar trigger para validar subscriptions
DROP TRIGGER IF EXISTS validate_subscription_plan ON public.user_subscriptions;
CREATE TRIGGER validate_subscription_plan
  BEFORE INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_subscription_not_free();