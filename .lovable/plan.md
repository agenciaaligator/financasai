## Objetivo

Preparar o Dona Wilma para o novo modelo de cobrança da Meta (01/10/2026): contar mensagens cobráveis por ciclo de assinatura, amarrar franquia ao plano, avisar em 80%, tolerar até 120% e travar a partir daí, com visibilidade pro usuário e pro admin. **Não mexo no fluxo de conversa** — só adiciono contagem, checagem de limite e telemetria.

### Decisões confirmadas
- Franquia Premium Mensal e Anual: **1.000 msgs/ciclo**
- Sem plano de entrada agora
- Comportamento: **híbrido** — soft cap até 120%, hard cap a partir daí
- Custo por mensagem: **campo editável no admin, default R$ 0,05**
- Ajuste extra que já vou fazer: alinhar `price_monthly` do Premium para **R$ 24,90** (hoje está R$ 29,90 no banco) e `price_yearly` para **R$ 239,00**

---

## Etapa 1 — Schema (aprovar antes de qualquer código)

Vou criar/ajustar via migration única, na ordem GRANT → RLS → policy pra cada tabela nova.

**Nova tabela `usage_mensagens`** (contador por ciclo, uma linha por usuário/ciclo):
- `user_id`, `ciclo_inicio` (date, primeiro dia do ciclo do assinante), `ciclo_fim` (date), `qtd_mensagens_cobradas` (int, default 0), `atualizado_em`
- Unique em `(user_id, ciclo_inicio)` pra idempotência
- RLS: usuário lê o próprio; service_role escreve; admin lê tudo via `has_role(uid,'admin')`

**Nova tabela `whatsapp_cost_config`** (singleton editável pelo admin):
- `id` fixo, `custo_por_mensagem_brl` (numeric, default 0.05), `atualizado_em`, `atualizado_por`
- RLS: qualquer autenticado lê (pra mostrar no painel); só admin atualiza

**Ajustes em `subscription_plans`**:
- Adicionar coluna `limite_mensagens_mes` (int, nullable — null = ilimitado)
- Popular: `premium` = 1.000; demais ficam null (não estão ativos)
- Atualizar `premium` para `price_monthly=24.90`, `price_yearly=239.00`

**Função SQL `increment_usage_mensagens(p_user_id uuid, p_qtd int)`** (security definer):
- Descobre o ciclo atual pelo `user_subscriptions.current_period_start/end` do usuário
- `INSERT ... ON CONFLICT (user_id, ciclo_inicio) DO UPDATE SET qtd_mensagens_cobradas = qtd_mensagens_cobradas + p_qtd`
- Retorna `{ qtd_atual, limite, percentual, bloqueado }`

**Função SQL `get_usage_status(p_user_id uuid)`** (security definer, stable):
- Retorna qtd atual, limite do plano, % de uso, estado (`ok` | `warning` a partir de 80% | `over` de 100-120% | `blocked` acima de 120%)

---

## Etapa 2 — Edge function `whatsapp-usage-increment`

Endpoint HTTP que n8n/Make/backend chamam a cada mensagem cobrável enviada pela Wilma:

- `POST /functions/v1/whatsapp-usage-increment`
- Body: `{ user_id, qtd? = 1, mensagem_id? }` (o `mensagem_id` serve pra deduplicar se você reprocessar; se vier repetido, no-op)
- Auth: header `x-webhook-secret` com secret novo `WHATSAPP_USAGE_SECRET` (não JWT — chamada de servidor)
- Chama a função `increment_usage_mensagens` e responde com o status atualizado (útil pro n8n decidir se envia ou não a próxima)
- `verify_jwt = false` no `config.toml`

---

## Etapa 3 — Enforcement (soft/hard cap) no agente

Ponto único de checagem antes de responder: função helper `checkUsageBeforeReply(user_id)` que:

1. Chama `get_usage_status`
2. Se `blocked` (>120%): retorna instrução pro agente enviar **uma única mensagem-padrão** ("Você atingiu o limite do seu plano este mês. Renove ou faça upgrade em donawilma.com.br…") e **não** incrementa mais o contador daquela linha
3. Se `warning` (>=80% pela primeira vez no ciclo) ou `over` (>=100%): envia carinhosamente um aviso junto da resposta normal (flag `aviso_enviado_80`/`aviso_enviado_100` nova em `usage_mensagens` pra não repetir)
4. Caso contrário: resposta normal

Só mexo no ponto de saída do agente (não na lógica de NLP/roteamento).

---

## Etapa 4 — Painel do usuário

Novo bloco **"Seu uso este mês"** no Dashboard (bento grid, ao lado dos cards de saldo):
- "X de Y mensagens" + barra de progresso
- Verde <80%, âmbar 80-100%, vermelho >100%
- Hook `useMessageUsage()` que consulta `get_usage_status` e assina realtime na `usage_mensagens` pra atualizar sem refresh
- i18n em todos os 5 locales

---

## Etapa 5 — Admin

Nova aba **"Uso WhatsApp"** em `AdminPanel`:
- Tabela: email · plano · mensagens no ciclo · % da franquia · custo estimado (`qtd × custo_por_mensagem_brl`)
- Filtros: só quem passou de 80%, só ativos, busca por email
- Card no topo com **custo total estimado do mês** (soma de todos)
- Campo editável **"Custo por mensagem (R$)"** que persiste em `whatsapp_cost_config`

---

## Detalhes técnicos

- Ciclo = período da assinatura Stripe (`user_subscriptions.current_period_start`/`end`), não mês-calendário. Isso evita virar contador no dia 1 pra quem assinou dia 15.
- Idempotência: `mensagem_id` opcional no payload de incremento; se você já mandar isso do n8n, guardo num set curto (tabela `usage_message_log` com TTL de 7 dias) pra rejeitar duplicados. **Confirmar se você quer isso** ou se n8n garante entrega única — economiza uma tabela se garantir.
- Realtime: habilitar `usage_mensagens` na publication pra o painel atualizar em tempo real quando o n8n incrementar.
- Não altero: fluxo de conversa, categorização, transações, agendamentos, Stripe webhook, Google Calendar.

---

## Ordem de execução

1. Migration (schema + função SQL + seed do Premium com franquia + preço corrigido)
2. Edge function `whatsapp-usage-increment` + secret
3. Painel do usuário (bloco de uso)
4. Admin (aba de uso + config de custo)
5. Enforcement no agente (por último, depois que o contador estiver rodando e você tiver validado dados reais)

Aprovando, mando primeiro só a migration pra você revisar o schema antes de popular Premium com R$ 24,90 e franquia 1.000.