-- Limpeza COMPLETA do usuário alexandremkt@hotmail.com
-- User ID: 23cb5f4c-477e-4359-8441-1d56c063c74e

DO $$
DECLARE
  v_user_id uuid := '23cb5f4c-477e-4359-8441-1d56c063c74e';
BEGIN
  -- 1. Deletar work_hours
  DELETE FROM work_hours WHERE user_id = v_user_id;
  
  -- 2. Deletar categories
  DELETE FROM categories WHERE user_id = v_user_id;
  
  -- 3. Deletar organization_members
  DELETE FROM organization_members WHERE user_id = v_user_id;
  
  -- 4. Deletar organizations
  DELETE FROM organizations WHERE owner_id = v_user_id;
  
  -- 5. Deletar user_subscriptions
  DELETE FROM user_subscriptions WHERE user_id = v_user_id;
  
  -- 6. Deletar user_roles
  DELETE FROM user_roles WHERE user_id = v_user_id;
  
  -- 7. Deletar profiles
  DELETE FROM profiles WHERE user_id = v_user_id;
  
  -- 8. Deletar whatsapp_validation_codes por telefone
  DELETE FROM whatsapp_validation_codes WHERE phone_number LIKE '%11911751247%';
  
  -- 9. Deletar whatsapp_sessions por telefone
  DELETE FROM whatsapp_sessions WHERE phone_number LIKE '%11911751247%';
END $$;