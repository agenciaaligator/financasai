-- Deletar usuários de teste e seus dados relacionados
-- Primeiro, buscar os IDs dos usuários
DO $$
DECLARE
    user1_id UUID;
    user2_id UUID;
BEGIN
    -- Buscar ID do primeiro usuário teste
    SELECT id INTO user1_id FROM auth.users WHERE email = 'agenciaaligator@gmail.com';
    
    -- Buscar ID do segundo usuário teste  
    SELECT id INTO user2_id FROM auth.users WHERE email = 'adwords@aligator.com.br';
    
    -- Deletar dados relacionados do primeiro usuário se existir
    IF user1_id IS NOT NULL THEN
        DELETE FROM public.transactions WHERE user_id = user1_id;
        DELETE FROM public.categories WHERE user_id = user1_id;
        DELETE FROM public.profiles WHERE user_id = user1_id;
        DELETE FROM auth.users WHERE id = user1_id;
        RAISE NOTICE 'Usuário agenciaaligator@gmail.com e dados relacionados deletados';
    ELSE
        RAISE NOTICE 'Usuário agenciaaligator@gmail.com não encontrado';
    END IF;
    
    -- Deletar dados relacionados do segundo usuário se existir
    IF user2_id IS NOT NULL THEN
        DELETE FROM public.transactions WHERE user_id = user2_id;
        DELETE FROM public.categories WHERE user_id = user2_id;
        DELETE FROM public.profiles WHERE user_id = user2_id;
        DELETE FROM auth.users WHERE id = user2_id;
        RAISE NOTICE 'Usuário adwords@aligator.com.br e dados relacionados deletados';
    ELSE
        RAISE NOTICE 'Usuário adwords@aligator.com.br não encontrado';
    END IF;
END $$;