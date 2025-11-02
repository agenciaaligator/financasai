-- Adicionar lembrete de 2 horas (120 minutos) para o usuário
UPDATE reminder_settings 
SET default_reminders = '[
  {"time": 1440, "enabled": true},
  {"time": 120, "enabled": true},
  {"time": 60, "enabled": true}
]'::jsonb
WHERE user_id = '2efec051-aa64-4f31-8c1b-c22ac51d7d7b';

-- Resetar lembretes dos próximos compromissos para permitir novo envio
UPDATE commitments 
SET 
  scheduled_reminders = '[]'::jsonb,
  reminders_sent = '{"week": false, "day": false, "hours": false, "confirmed": false}'::jsonb
WHERE scheduled_at >= NOW()
  AND user_id = '2efec051-aa64-4f31-8c1b-c22ac51d7d7b';