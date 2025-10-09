# Sistema de Lembretes e Google Calendar

## ✅ Funcionalidades Implementadas

### 1. Edição/Remarcação de Compromissos via WhatsApp

**Comandos disponíveis:**
- `editar compromisso` - Edita um compromisso existente
- `remarcar compromisso` - Remarca um compromisso (mesmo que editar)
- `cancelar compromisso` - Cancela/exclui um compromisso

**Fluxo de edição:**
1. Usuario digita "editar compromisso"
2. Sistema lista os próximos 5 compromissos
3. Usuário escolhe o número do compromisso
4. Sistema oferece opções: Título, Data, Hora, Categoria
5. Usuário escolhe o que editar
6. Usuário fornece o novo valor
7. Sistema atualiza o compromisso

**Fluxo de cancelamento:**
1. Usuário digita "cancelar compromisso"
2. Sistema lista os próximos 5 compromissos
3. Usuário escolhe o número do compromisso
4. Sistema cancela e confirma

### 2. Lembretes Automáticos (Edge Function)

**Arquivo:** `supabase/functions/send-commitment-reminders/index.ts`

**Funcionamento:**
- Edge function que roda periodicamente (via cron job)
- Busca compromissos que:
  - Estão entre 24h e 23h antes do horário agendado
  - Ainda não tiveram lembrete enviado (`reminder_sent = false`)
- Envia mensagem via WhatsApp com:
  - Ícone da categoria
  - Título do compromisso
  - Data/hora formatada em português
  - Descrição (se houver)
  - Opção para remarcar
- Marca compromisso como `reminder_sent = true` após enviar

**Configuração do Cron Job:**

Para ativar os lembretes automáticos, você precisa configurar um cron job no Supabase que execute a função a cada hora:

```sql
-- Primeiro, ative as extensões necessárias no SQL Editor do Supabase:
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Depois, crie o cron job:
select cron.schedule(
  'send-commitment-reminders-hourly',
  '0 * * * *', -- A cada hora no minuto 0
  $$
  select net.http_post(
    url:='https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-commitment-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**Para verificar se o cron job está rodando:**
```sql
SELECT * FROM cron.job;
```

**Para ver logs do cron job:**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-commitment-reminders-hourly')
ORDER BY start_time DESC 
LIMIT 10;
```

**Para remover o cron job:**
```sql
SELECT cron.unschedule('send-commitment-reminders-hourly');
```

## 🔄 Próxima Etapa: Integração com Google Calendar

### Preparação

1. **Criar projeto no Google Cloud Console:**
   - Acesse https://console.cloud.google.com
   - Crie um novo projeto ou use existente
   - Ative a Google Calendar API

2. **Configurar OAuth 2.0:**
   - Criar credenciais OAuth 2.0
   - Adicionar redirect URI: `https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/google-calendar-callback`
   - Obter Client ID e Client Secret

3. **Adicionar secrets no Supabase:**
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### Funcionalidades a Implementar

1. **Autenticação Google:**
   - Comando via WhatsApp: "conectar google calendar"
   - Fluxo OAuth para autorizar acesso
   - Salvar tokens de acesso e refresh em tabela

2. **Sincronização Bidirecional:**
   - Ao criar compromisso no WhatsApp → criar no Google Calendar
   - Ao editar compromisso no WhatsApp → atualizar no Google Calendar
   - Ao cancelar compromisso no WhatsApp → deletar do Google Calendar
   - Webhook do Google Calendar → atualizar no banco

3. **Nova Tabela:**
```sql
CREATE TABLE google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

4. **Atualizar tabela commitments:**
   - Já existe coluna `google_event_id TEXT`
   - Será usada para mapear eventos

### Edge Functions Necessárias

1. **google-calendar-auth** - Iniciar fluxo OAuth
2. **google-calendar-callback** - Receber código de autorização
3. **google-calendar-sync** - Sincronizar eventos
4. **google-calendar-webhook** - Receber updates do Google

## 📝 Comandos Atualizados no Menu de Ajuda

Os comandos de agenda já foram atualizados no menu de ajuda:
- "agendar dentista amanhã 14h"
- "compromisso reunião sexta 10h"
- "meus compromissos"
- "próximos eventos"
- **"editar compromisso" (NOVO)**
- **"remarcar compromisso" (NOVO)**
- **"cancelar compromisso" (NOVO)**

## 🔍 Testando

### Testar Edição:
1. "agendar dentista amanhã 14h"
2. "editar compromisso"
3. Selecionar o número
4. Escolher o que editar
5. Fornecer novo valor

### Testar Cancelamento:
1. "cancelar compromisso"
2. Selecionar o número do compromisso

### Testar Lembretes (manual):
```bash
# Via curl (substitua PROJECT_ID e ANON_KEY):
curl -X POST \
  https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/send-commitment-reminders \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYW1sbmxhYmRqb3FwaXVoZ2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxOTE0MzYsImV4cCI6MjA2Nzc2NzQzNn0.T2KJeHIfVomYe58J-lt8beMByX00kloteIIvz1whyaM" \
  -H "Content-Type: application/json"
```
