-- Remover job de lembretes que dispara a cada hora (causa duplicação)
SELECT cron.unschedule('send-commitment-reminders-hourly');

-- Remover job de resumo diário às 7h (causa duplicação)
SELECT cron.unschedule('send-daily-agenda-7am-brt');