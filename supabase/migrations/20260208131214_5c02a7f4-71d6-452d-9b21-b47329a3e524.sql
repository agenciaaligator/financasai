-- PARAR IMEDIATAMENTE notificações: desativar crons de lembretes/agenda
SELECT cron.unschedule(8);  -- send-commitment-reminders-5min
SELECT cron.unschedule(9);  -- send-daily-agenda-8am