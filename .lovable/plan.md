
# Integração Google Agenda — Plano Final
**Domínio donawilma.com.br + zero custo de lembretes no Supabase**

---

## Princípios

1. **Domínio**: usuário só vê `https://donawilma.com.br`. Nenhum link `lovable.app`.
2. **Lembretes 100% pelo Google** — push no celular + e-mail nativos. **Nenhum cron de lembrete no Supabase.**
3. **Conexão permanente** — 4 mecanismos garantem que ninguém precise reconectar manualmente.
4. **2 caminhos de conexão**: pelo app OU pelo WhatsApp (link mágico).
5. **Zero impacto** nas funcionalidades atuais.

---

## ⚠️ Garantia de custo zero com lembretes

| Item | Esta proposta | O que causou bloqueio antes |
|---|---|---|
| Cron de lembrete por minuto | ❌ NÃO EXISTE | ✅ Existia (1×/min = 43.200 execuções/mês) |
| Cron de lembrete diário | ❌ NÃO EXISTE | — |
| Polling da agenda | ❌ NÃO EXISTE | — |
| Mensagens de lembrete pelo WhatsApp | ❌ NÃO EXISTE | — |
| Quem dispara o lembrete | **Google** (push + e-mail) | Supabase |
| Custo recorrente Supabase para lembretes | **R$ 0** | Alto |

**Cron antigo `send-commitment-reminders-5min` será DESATIVADO/REMOVIDO.**

A única coisa que roda no Supabase de forma agendada é **1 cron por dia às 03:00** que renova os tokens dos webhooks do Google que estão prestes a expirar (ver "Conexão permanente"). É 1 execução por dia por usuário com agenda conectada — custo desprezível e tem natureza de manutenção, não de envio de mensagens.

---

## Como o usuário recebe os lembretes

Ao criar um compromisso (pelo app ou pelo WhatsApp), os lembretes são definidos como propriedades do **evento no Google Calendar**. Daí em diante:

- Push notification no celular (app Google Calendar / Gmail)
- E-mail automático do Google (opcional, configurável pelo usuário)
- Funciona mesmo se o app Dona Wilma estiver offline
- Funciona mesmo se o Supabase estiver offline
- Custo: **R$ 0** — Google envia tudo

Por padrão configuramos 2 lembretes nativos do Google:
- **30 minutos antes** (popup/push)
- **1 dia antes às 9h** (e-mail)

O usuário pode customizar na aba Agenda (3 a 5 cliques) ou direto no Google Calendar.

---

## URLs (todas em donawilma.com.br)

| Onde aparece | URL |
|---|---|
| Link enviado no WhatsApp | `https://donawilma.com.br/conectar-agenda?token=xxx` |
| Botão de conectar no app | `https://donawilma.com.br/agenda` |
| Callback do Google (Google → Supabase, invisível) | `https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/google-calendar-callback` |
| Redirect final pós-autorização | `https://donawilma.com.br/agenda?connected=true` |
| Listagem de compromissos | `https://donawilma.com.br/agenda` |

Todas construídas via `buildSiteUrl()` do `src/lib/siteUrl.ts`.

---

## Por que a agenda desconectava antes — soluções aplicadas

### 1. Refresh token sempre solicitado
URL OAuth construída com `access_type=offline` + `prompt=consent`. Sem isso o Google não devolve refresh token e tudo expira em 1h.

### 2. Auto-renovação transparente do access token
Helper `getValidGoogleToken(connection_id)` usado por todas as funções: verifica `expires_at`, se expirou troca refresh_token por novo access_token e salva. Usuário nunca percebe.

### 3. Renovação automática do webhook do Google
Webhooks do Google Calendar expiram em até 7 dias. Cron `renew-google-watches` roda **1× por dia às 03:00** e renova qualquer watch que vence em <24h. Único cron deste plano.

### 4. Detecção e aviso proativo
Se chamada à API do Google retorna 401 (usuário revogou no painel Google):
- Marca `calendar_connections.needs_reauth = true`
- Envia 1 mensagem WhatsApp informando: *"Sua agenda Google se desconectou, toque aqui pra reconectar"*

### 5. Passo manual seu (te guio na hora)
Publicar app no Google Cloud Console em modo "In production". Sem isso, Google força reautenticação a cada 7 dias mesmo com refresh token. Para escopo `calendar.events` **não exige verificação do Google**, é só clicar em publicar.

---

## UX do usuário

### Caminho A — Pelo app
1. Aba **"Agenda"** no dashboard → botão "Conectar Google Agenda"
2. Janela do Google → autoriza → volta com "Conectado ✓"

### Caminho B — Pelo WhatsApp (Dona Wilma)
1. Manda: *"quero conectar minha agenda"*
2. Bot responde com `https://donawilma.com.br/conectar-agenda?token=xxx`
3. Toca no link → autoriza no Google → bot confirma

### Criar compromisso pelo WhatsApp
1. *"agenda dentista quinta às 15h"*
2. Bot cria evento direto no Google Calendar (já com lembretes nativos configurados)
3. Google entrega o lembrete na hora certa — Supabase nem é acionado

---

## Edge Functions (apenas 5, todas sob demanda — exceto 1 cron de manutenção)

| Função | Quando roda | Custo |
|---|---|---|
| `google-calendar-auth` | Sob demanda (clique do usuário) | Desprezível |
| `google-calendar-callback` | Sob demanda (1× ao conectar) | Desprezível |
| `google-calendar-webhook` | Quando Google avisa que houve mudança na agenda | Push, não polling — desprezível |
| `google-calendar-sync` | Sob demanda (botão "sincronizar agora") | Desprezível |
| `renew-google-watches` | **1× por dia às 03:00** (única coisa agendada) | ~30 execuções/mês |

Helper compartilhado: `supabase/functions/_shared/google-token.ts` com `getValidGoogleToken()`.

**NÃO existirão**: `send-commitment-reminders`, `send-daily-agenda`, nem variações.

---

## Banco de dados — alterações mínimas

```sql
ALTER TABLE calendar_connections
  ADD COLUMN last_sync_at TIMESTAMPTZ,
  ADD COLUMN webhook_channel_id TEXT,
  ADD COLUMN webhook_resource_id TEXT,
  ADD COLUMN webhook_expires_at TIMESTAMPTZ,
  ADD COLUMN needs_reauth BOOLEAN DEFAULT false;

CREATE TABLE calendar_connection_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: service_role only
```

A tabela `commitments` continua existindo só para listar/exibir os compromissos no app (espelho do que está no Google). Os campos `reminder_sent` / `reminders_sent` ficam ali mas **não serão mais usados** — podem ser removidos depois numa limpeza.

---

## Limpeza de crons existentes (importante!)

Função `get_cron_jobs_status()` mostra que existem hoje:
- `send-commitment-reminders-5min` ← **REMOVER**
- `send-daily-agenda-8am` ← **REMOVER**
- `sync-all-google-calendars-10min` ← **REMOVER**

Migration vai dropar os 3 com `cron.unschedule(...)`. Único cron novo: `renew-google-watches` (diário 03:00).

---

## Frontend novo

```text
src/components/dashboard/
├── AgendaPage.tsx
├── AgendaConnectionCard.tsx
├── AgendaReminderSettings.tsx     ← define defaults dos lembretes do Google
├── CommitmentsList.tsx
├── CommitmentForm.tsx             ← inclui lembretes do Google
└── CommitmentCard.tsx

src/pages/
└── ConnectCalendar.tsx            ← /conectar-agenda?token=xxx

src/hooks/
├── useGoogleCalendar.ts
└── useCommitments.ts
```

`DashboardTabs.tsx`: nova aba **"Agenda"**.
`whatsapp-agent`: 2 intents novas — "conectar agenda" e "meus compromissos".

---

## Configuração no Google Cloud Console (te guio na hora)

1. **APIs & Services → Library**: ativar Google Calendar API
2. **OAuth consent screen → Authorized domains**: `donawilma.com.br` e `supabase.co`
3. **OAuth consent screen → Publish App** → "In production"
4. **Credentials → Authorized redirect URIs**:
   `https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/google-calendar-callback`
5. **Authorized JavaScript origins**: `https://donawilma.com.br`

Secrets `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` já existem.

---

## Controle de acesso
Usa `subscription_plans.has_google_calendar` que já existe. Admin tem acesso total.

---

## Internacionalização
Chaves novas em pt-BR, pt-PT, en-US, es-ES, it-IT.

---

## Impacto no que já funciona

| Área | Impacto |
|---|---|
| Transações, categorias, relatórios | Nenhum |
| Agente WhatsApp atual | Ganha 2 intents novas (não-destrutivo) |
| `recurring_transactions` (lembretes financeiros) | Nenhum |
| 3 crons antigos que pesavam no Supabase | **Removidos** — alívio imediato no consumo |
| Assinatura/admin | Nenhum |

---

## Estimativas
- **Tempo de implementação**: 1-2 dias
- **Custo Google API**: R$ 0 (Calendar API é gratuita)
- **Custo Supabase recorrente**: praticamente zero — só 30 execuções/mês do cron de manutenção de webhooks
- **Frequência de reconexão pelo usuário**: nunca (com as 4 proteções + app publicado)

---

Aprovação libera implementação completa.
