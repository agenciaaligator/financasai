

## Notificação WhatsApp para Metas Mensais — Funcionalidade Inexistente

### Diagnóstico

Não existe nenhuma lógica implementada para enviar notificações via WhatsApp quando uma meta mensal é atingida ou ultrapassada. O sistema atual:

1. **Frontend**: O hook `useMonthlyGoals` calcula o progresso (percentual gasto vs meta) e exibe barras coloridas na UI (verde/amarelo/vermelho)
2. **Backend**: Não há nenhum trigger, cron job ou edge function que monitore o progresso das metas e envie alertas
3. **WhatsApp agent**: Não tem lógica de metas — só processa transações, OCR e consultas de saldo

### Plano de Implementação

**1. Criar tabela `goal_alerts_sent`** para evitar notificações duplicadas:
- `id`, `user_id`, `goal_id`, `month` (YYYY-MM), `threshold` (70, 90, 100), `sent_at`
- Unique constraint em `(goal_id, month, threshold)`

**2. Criar edge function `check-goal-alerts`** que:
- Busca todos os goals ativos
- Para cada goal, calcula o gasto do mês atual na categoria
- Se percentual >= 70%, 90% ou 100% e ainda não enviou alerta para esse threshold/mês:
  - Busca sessão WhatsApp do usuário
  - Envia mensagem via WhatsApp API (ex: "⚠️ Você já gastou 85% da sua meta de R$ 300 em Alimentação este mês (R$ 255/R$ 300)")
  - Registra na `goal_alerts_sent`

**3. Disparar verificação após nova transação**:
- No `useTransactions.ts`, após `addTransaction` com sucesso, chamar `supabase.functions.invoke('check-goal-alerts')` para o usuário atual
- Alternativa: trigger no banco após INSERT em `transactions` que chama a edge function (mais confiável, captura transações do WhatsApp também)

**4. Mensagens por threshold**:
- **70%**: "📊 Atenção! Você já usou 70% da meta de {categoria} ({gasto}/{meta})"
- **90%**: "⚠️ Cuidado! Você está em 90% da meta de {categoria} ({gasto}/{meta})"
- **100%+**: "🚨 Meta ultrapassada! Você gastou {gasto} de {meta} em {categoria}"

### Arquivos Afetados

1. **Nova migração SQL** — tabela `goal_alerts_sent` com RLS
2. **Nova edge function** `supabase/functions/check-goal-alerts/index.ts`
3. **`supabase/config.toml`** — registrar nova function
4. **`src/hooks/useTransactions.ts`** — chamar check após addTransaction
5. **`supabase/functions/whatsapp-agent/index.ts`** — também chamar check após registrar transação via WhatsApp

