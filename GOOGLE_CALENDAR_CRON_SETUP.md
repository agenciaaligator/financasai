# Configuração de Cron Jobs - Google Calendar

Este documento detalha os cron jobs necessários para o funcionamento automático do Google Calendar.

## Cron Jobs Necessários

### 1. check-google-calendar-tokens (Renovação de Tokens)

**Objetivo**: Renovar tokens do Google Calendar que expiram nas próximas 24 horas.

**Frequência**: A cada 6 horas

**SQL**:
```sql
SELECT cron.schedule(
  'check-google-calendar-tokens-6h',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/check-google-calendar-tokens',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### 2. sync-all-google-calendars (Sincronização)

**Objetivo**: Sincronizar eventos do Google Calendar para todos os usuários conectados.

**Frequência**: 2x ao dia (8h e 20h)

**SQL**:
```sql
-- Primeiro, remover o cron antigo se existir
SELECT cron.unschedule('sync-all-google-calendars-10min');

-- Criar novo cron
SELECT cron.schedule(
  'sync-all-google-calendars-2xday',
  '0 8,20 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/sync-all-google-calendars',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

## Como Executar

1. Acesse o SQL Editor do Supabase:
   https://supabase.com/dashboard/project/fsamlnlabdjoqpiuhgex/sql/new

2. Cole e execute cada SQL acima separadamente

3. Verifique os crons criados:
```sql
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname LIKE '%google%'
ORDER BY jobname;
```

## Verificar Status

Para verificar o status dos cron jobs e última execução:

```sql
SELECT * FROM public.get_cron_jobs_status();
```

## Logs de Execução

Para verificar os logs das últimas execuções:

```sql
SELECT 
  j.jobname,
  r.start_time,
  r.end_time,
  r.status,
  r.return_message
FROM cron.job j
LEFT JOIN cron.job_run_details r ON r.jobid = j.jobid
WHERE j.jobname LIKE '%google%'
ORDER BY r.start_time DESC
LIMIT 20;
```

## Troubleshooting

### Tokens não renovam automaticamente

1. Verificar se o cron está ativo:
```sql
SELECT active FROM cron.job WHERE jobname = 'check-google-calendar-tokens-6h';
```

2. Verificar logs da edge function:
https://supabase.com/dashboard/project/fsamlnlabdjoqpiuhgex/functions/check-google-calendar-tokens/logs

3. Testar manualmente:
```sql
SELECT
  net.http_post(
    url := 'https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/check-google-calendar-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM'
    ),
    body := '{}'::jsonb
  );
```

### Sincronização não acontece

1. Verificar conexões ativas:
```sql
SELECT user_id, calendar_email, is_active, expires_at, updated_at
FROM calendar_connections
WHERE provider = 'google'
ORDER BY updated_at DESC;
```

2. Verificar últimos compromissos importados:
```sql
SELECT c.id, c.title, c.scheduled_at, c.google_event_id, c.user_id
FROM commitments c
WHERE c.google_event_id IS NOT NULL
ORDER BY c.created_at DESC
LIMIT 10;
```

## Desabilitar Crons (se necessário)

```sql
-- Desabilitar check-tokens
SELECT cron.unschedule('check-google-calendar-tokens-6h');

-- Desabilitar sync-all
SELECT cron.unschedule('sync-all-google-calendars-2xday');
```
