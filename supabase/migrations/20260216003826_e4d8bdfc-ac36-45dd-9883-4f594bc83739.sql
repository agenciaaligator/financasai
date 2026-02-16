
-- Garantir unicidade de user_id em profiles
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Garantir unicidade de user_id em user_subscriptions  
ALTER TABLE public.user_subscriptions 
  ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);
