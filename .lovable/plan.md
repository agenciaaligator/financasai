

## Checklist Pré-Lançamento — Revisão Completa do Sistema

### Sobre o custo no Supabase

As consultas que fiz (SELECT nas tabelas) **não consomem dados significativos** do seu plano. O Supabase cobra por:
- **Database size** (armazenamento) — não muda com SELECTs
- **Edge Function invocations** — cada chamada do `check-goal-alerts` conta como 1 invocação
- **Bandwidth** — dados transferidos, mas queries pequenas são desprezíveis

O plano Free do Supabase inclui 500K invocações de edge functions/mês. Cada despesa adicionada dispara 1 invocação extra do `check-goal-alerts`. Impacto negligível.

---

### Sobre o alerta WhatsApp não recebido

O log mostra: `"Sending 100% alert for goal ... (Alimentação: 106%)"` e `"Done. Checked 1 goals, sent 1 alerts"`. A função registrou o envio na tabela `goal_alerts_sent` (threshold=100, month=2026-03).

**Problema provável**: O alerta 100% **já tinha sido enviado antes** na invocação manual de teste. Quando você adicionou a despesa de 60, o gasto total já era R$ 318,70 (106% de R$ 300). Como o threshold 100 já estava registrado, **a nova despesa não disparou nada novo**. Os thresholds são: 70%, 90%, 100% — não há threshold acima de 100%.

**Correção**: Adicionar thresholds extras acima de 100% (ex: 120%, 150%) para alertar sobre estouros crescentes, OU permitir re-envio do alerta 100% quando o percentual sobe mais 20pp.

---

### Checklist Completo por Área

#### 1. DASHBOARD — OK
- [x] SummaryCards usa `formatCurrency()` dinâmico
- [x] Mostra dados do mês atual corretamente
- [x] FinancialChart traduzido
- [x] BalanceAlert funciona

#### 2. TRANSAÇÕES — 1 bug encontrado
- [x] TransactionForm sem "(R$)" hardcoded
- [x] Categorias traduzidas com `translateCategoryName`
- [x] Filtros funcionais (período, tipo, busca)
- [x] Paginação implementada
- [x] EditTransactionModal com sugestão traduzida
- [x] Toasts do `useTransactions` internacionalizados
- **BUG**: `DashboardContent.tsx` linhas 267 e 352 — labels "conversas financeiras" nos headers de transações. Deveria ser "movimentações financeiras" ou "transações". As chaves i18n `yourLatestMovements` e `yourConversations` já existem mas os fallbacks e traduções em inglês/espanhol dizem "conversations" em vez de "transactions".

#### 3. CATEGORIAS — OK
- [x] CategoryManager funcional
- [x] Tradução de categorias no dropdown

#### 4. METAS — 2 bugs
- [x] GoalModal sincroniza state com `useEffect`
- [x] Categorias traduzidas
- [x] Barras de progresso coloridas
- **BUG 1**: `useMonthlyGoals.ts` linha 74 — toast de erro com texto hardcoded `'Erro'` em português, sem i18n
- **BUG 2**: Sistema de alertas WhatsApp não reenvia após threshold 100% ser atingido. Precisa de thresholds adicionais (120%, 150%) ou lógica de re-alerta

#### 5. RELATÓRIOS — OK
- [x] Filtros avançados (período, tipo, categoria, busca)
- [x] Gráfico de evolução 12 meses
- [x] Top categorias receita e despesa
- [x] Métricas de período
- [x] formatCurrency dinâmico

#### 6. SIDEBAR / NAVEGAÇÃO — OK
- [x] Item WhatsApp adicionado
- [x] Todos os itens traduzidos

#### 7. PERFIL — OK (sem mudanças pendentes)

#### 8. WHATSAPP PAGE — OK

#### 9. RECURRING TRANSACTIONS — OK
- [x] Categorias traduzidas no form

#### 10. AUTH / SUBSCRIPTION GUARD — OK
- [x] Lógica de grace period funcional
- [x] Master/admin bypass correto

---

### Correções Necessárias (3 itens)

**1. Labels "conversas" → "transações"** em `DashboardContent.tsx` — trocar os fallback texts e atualizar os 5 locale files para usar "movimentações/transações" em vez de "conversas"

**2. Toast hardcoded em `useMonthlyGoals.ts`** — trocar `'Erro'` por `t('common.error', 'Erro')` (precisa importar `useTranslation`)

**3. Alertas WhatsApp pós-100%** — adicionar thresholds `[70, 90, 100, 120, 150]` no `check-goal-alerts/index.ts` para que o usuário receba alerta quando ultrapassar 120% e 150% da meta. Também limpar os registros de `goal_alerts_sent` do mês quando a meta é editada (valor alterado), para que os alertas sejam recalculados com o novo valor.

### Arquivos Afetados (4)
1. `src/components/dashboard/DashboardContent.tsx` — labels "conversas"
2. `src/hooks/useMonthlyGoals.ts` — i18n no toast de erro
3. `supabase/functions/check-goal-alerts/index.ts` — thresholds extras
4. `src/locales/*.json` (5 files) — corrigir chaves "conversations"

