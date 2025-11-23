-- Criar compromisso de teste para validar sistema de notificações
-- Este compromisso será agendado para daqui a 45 minutos, entrando na janela de 60min
INSERT INTO commitments (
  user_id, 
  title, 
  category, 
  scheduled_at,
  scheduled_reminders,
  reminders_sent,
  description,
  duration_minutes,
  reminder_sent
)
VALUES (
  '2efec051-aa64-4f31-8c1b-c22ac51d7d7b',
  '🧪 TESTE - Notificação WhatsApp',
  'other',
  NOW() + INTERVAL '45 minutes',
  '[{"time": 60, "enabled": true}, {"time": 120, "enabled": true}, {"time": 1440, "enabled": true}]'::jsonb,
  '{"60": false, "120": false, "1440": false}'::jsonb,
  'Compromisso de teste criado automaticamente para validar sistema de notificações WhatsApp. Deve disparar notificação quando faltar 60 minutos.',
  30,
  false
)
ON CONFLICT DO NOTHING;