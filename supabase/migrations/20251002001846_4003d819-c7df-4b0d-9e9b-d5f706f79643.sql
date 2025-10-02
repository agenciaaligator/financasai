-- Delete test users and all their data
DO $$
DECLARE
  user1_id uuid;
  user2_id uuid;
BEGIN
  -- Get user IDs from emails
  SELECT id INTO user1_id FROM auth.users WHERE email = 'alexandremkt@hotmail.com';
  SELECT id INTO user2_id FROM auth.users WHERE email = 'agenciaaligator@gmail.com';
  
  -- Delete from public tables for user 1
  IF user1_id IS NOT NULL THEN
    DELETE FROM public.transactions WHERE user_id = user1_id;
    DELETE FROM public.categories WHERE user_id = user1_id;
    DELETE FROM public.whatsapp_sessions WHERE user_id = user1_id;
    DELETE FROM public.whatsapp_auth_codes WHERE user_id = user1_id;
    DELETE FROM public.profiles WHERE user_id = user1_id;
  END IF;
  
  -- Delete from public tables for user 2
  IF user2_id IS NOT NULL THEN
    DELETE FROM public.transactions WHERE user_id = user2_id;
    DELETE FROM public.categories WHERE user_id = user2_id;
    DELETE FROM public.whatsapp_sessions WHERE user_id = user2_id;
    DELETE FROM public.whatsapp_auth_codes WHERE user_id = user2_id;
    DELETE FROM public.profiles WHERE user_id = user2_id;
  END IF;
  
  -- Delete from auth.users (this will cascade to auth-related tables)
  DELETE FROM auth.users WHERE email IN ('alexandremkt@hotmail.com', 'agenciaaligator@gmail.com');
END $$;