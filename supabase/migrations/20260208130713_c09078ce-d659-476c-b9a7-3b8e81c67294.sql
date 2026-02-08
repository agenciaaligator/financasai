-- Desativar cron job do Google Calendar (notificações repetidas)
SELECT cron.unschedule(3);