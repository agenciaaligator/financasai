# Configuração do Cron Job para Expiração de Trials

## ⚠️ IMPORTANTE: Esta configuração precisa ser feita MANUALMENTE no Supabase Dashboard

A Edge Function `check-expired-trials` foi criada para processar automaticamente trials expirados, mas o Cron Job precisa ser configurado manualmente no Supabase.

## 📋 Passos para Configurar

### 1. Habilitar Extensões no Supabase

Acesse: **Supabase Dashboard > SQL Editor** e execute:

```sql
-- Habilitar pg_cron para agendamentos
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar pg_net para chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Criar o Cron Job

Execute no SQL Editor:

```sql
-- Executar todos os dias às 2h da manhã
SELECT cron.schedule(
  'check-expired-trials-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/check-expired-trials',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### 3. Verificar se o Cron Job está ativo

```sql
SELECT * FROM cron.job;
```

Você deve ver o job `check-expired-trials-daily` listado.

### 4. Testar Manualmente (Opcional)

Para testar a execução sem esperar o horário agendado:

```sql
SELECT cron.unschedule('check-expired-trials-daily');

-- Criar job de teste que executa a cada minuto
SELECT cron.schedule(
  'check-expired-trials-test',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/check-expired-trials',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- Aguarde alguns minutos e verifique os logs da Edge Function

-- Remover job de teste
SELECT cron.unschedule('check-expired-trials-test');

-- Recriar job de produção (diário às 2h)
SELECT cron.schedule(
  'check-expired-trials-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/check-expired-trials',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

### 5. Monitorar Logs

Para ver os logs de execução:
- Acesse: **Supabase Dashboard > Edge Functions > check-expired-trials > Logs**

## 🔄 Como Funciona

1. **Diariamente às 2h da manhã**, o Cron Job executa
2. Chama a Edge Function `check-expired-trials`
3. A função busca todos os trials com `current_period_end < now()`
4. Atualiza `status = 'expired'` na tabela `user_subscriptions`
5. Reverte `user_roles` de volta para `free`
6. Retorna log com quantidade de trials processados

## 📊 Sintaxe do Cron

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Dia da semana (0-7, onde 0 e 7 = Domingo)
│ │ │ └─── Mês (1-12)
│ │ └───── Dia do mês (1-31)
│ └─────── Hora (0-23)
└───────── Minuto (0-59)
```

Exemplos:
- `0 2 * * *` - Todos os dias às 2h
- `*/5 * * * *` - A cada 5 minutos
- `0 */6 * * *` - A cada 6 horas
- `0 0 * * 0` - Todo domingo à meia-noite

## ⚠️ Importante

- O Cron Job precisa usar o **ANON KEY** (não o SERVICE_ROLE_KEY)
- A Edge Function `check-expired-trials` tem `verify_jwt = false` para permitir chamadas do Cron
- Monitore os logs regularmente para garantir que está funcionando
