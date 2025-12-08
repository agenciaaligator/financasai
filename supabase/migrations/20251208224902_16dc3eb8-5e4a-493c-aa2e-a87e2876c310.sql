-- Restaurar role admin para o usuário master
UPDATE user_roles 
SET role = 'admin', updated_at = NOW() 
WHERE user_id = '2efec051-aa64-4f31-8c1b-c22ac51d7d7b';