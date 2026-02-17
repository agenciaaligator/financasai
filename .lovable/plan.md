

# Plano: Dashboard Intuitivo + Transacoes Simplificadas + WhatsApp Melhorado

Este plano aborda 3 grandes areas de melhoria, organizadas em ordem de impacto e dependencia.

---

## PARTE 1: Dashboard Mais Claro e Intuitivo

### 1.1 SummaryCards.tsx - Cards de Metricas Simplificados

**Remover**: Card "Status da Assinatura" (4o card)

**3 cards restantes** com subtitulos explicativos:

| Card | Titulo | Subtitulo | Icone |
|------|--------|-----------|-------|
| Saldo do Mes | Saldo do Mes | "Receitas menos despesas deste mes" | DollarSign |
| Receitas | Receitas | "Total recebido este mes" | TrendingUp (verde) |
| Despesas | Despesas | "Total gasto este mes" | TrendingDown (vermelho) |

- Grid muda de `grid-cols-4` para `grid-cols-3`
- Remover imports de `CheckCircle2`, `ExternalLink`, `AlertTriangle`, `XCircle`
- Remover `useSubscription`, `useSubscriptionGuard`, `useState`, `supabase`, `useToast`
- Remover funcao `handleManageSubscription` e `getStatusConfig`

### 1.2 FinancialChart.tsx - Grafico Mais Intuitivo

**Remover**: Grafico de barras "Por Categoria" (mover para Relatorios)

**Manter**: Apenas grafico de pizza "Receitas vs Despesas"

Alteracoes:
- Titulo: "Como esta seu dinheiro este mes"
- Legenda com fonte maior (16px, paddingTop 20px)
- Tooltip melhorado: "Receitas: R$ X,XX (Y%)"
- Cores ja estao corretas (#059669 verde, #dc2626 vermelho)

### 1.3 DashboardContent.tsx - Secao de Transacoes Recentes

Alteracoes no bloco `currentTab === "dashboard"`:
- Limitar a **5 transacoes** (em vez de 10)
- Titulo do card: "Suas ultimas movimentacoes"
- Adicionar link "Ver todas as transacoes" que navega para tab `transactions`

### 1.4 Locales

Adicionar chaves novas em todos os 5 arquivos:
- `summary.balanceSubtitle`: "Receitas menos despesas deste mes"
- `summary.incomeSubtitle`: "Total recebido este mes"
- `summary.expensesSubtitle`: "Total gasto este mes"
- `chart.howIsYourMoney`: "Como esta seu dinheiro este mes"
- `transactionList.yourLatestMovements`: "Suas ultimas movimentacoes"
- `transactionList.viewAllTransactions`: "Ver todas as transacoes"

---

## PARTE 2: Transacoes Simplificadas

### 2.1 TransactionFilters.tsx - Filtros Essenciais

**Remover**:
- Filtro "Fonte" (manual/WhatsApp) - dropdown completo
- Filtro "Categorias" - popover com Command (mover para Relatorios)
- Periodos complexos: `30days`, `90days`, `year`, `custom` (e todo o bloco de date range)

**Manter** (simplificado):
- **Periodo**: Todos | Hoje | Esta semana | Este mes | Ultimo mes (novo)
- **Tipo**: Todas | So receitas | So despesas
- **Busca**: Input com placeholder "Digite para buscar..."

O layout muda de grid 3 colunas para uma linha mais simples com 3 elementos.

Atualizar `TransactionFiltersState`:
```
period: 'all' | 'today' | 'week' | 'month' | 'last_month'
type: 'all' | 'income' | 'expense'
searchText: string
```

Remover `categories`, `source`, `customDateRange` do estado.

### 2.2 DashboardContent.tsx - Tab Transactions

- Atualizar filtros para novo formato simplificado
- Remover logica de `filters.source` e `filters.categories` do `filteredTransactions`
- Remover periodos `30days`, `90days`, `year`, `custom`
- Adicionar periodo `last_month`

### 2.3 TransactionList.tsx - Lista Mais Clara

Alteracoes:
- Datas em portugues amigavel: "Hoje", "Ontem", "15 de fev" (usar `formatDistanceToNow` ou logica custom)
- Remover badge "WhatsApp" / "Manual" (source) - simplificar
- Manter badge de categoria
- Melhorar estados vazios:
  - Sem transacoes: "Voce ainda nao tem movimentacoes. Que tal registrar sua primeira?"
  - Busca vazia: "Nao encontramos nada. Tente outros termos."

### 2.4 Locales

Atualizar/adicionar chaves:
- `filters.lastMonth`: "Ultimo mes"
- `filters.searchPlaceholder`: "Digite para buscar..."
- `transactionList.noTransactionsYet`: "Voce ainda nao tem movimentacoes. Que tal registrar sua primeira?"
- `transactionList.searchNoResults`: "Nao encontramos nada. Tente outros termos."
- `transactionList.yourTransactions`: "Suas Transacoes"
- `transactionList.allIncomeAndExpenses`: "Todas as suas receitas e despesas"

---

## PARTE 3: WhatsApp Agent Melhorado

### 3.1 Respostas Mais Humanas (PersonalizedResponses)

Atualizar `generateSaveResponse` para respostas mais claras e padronizadas:
- Formato consistente: "Anotei! [Tipo] de R$ X,XX em [Categoria]"
- Sempre incluir saldo atual
- Remover aleatoriedade excessiva (manter 2-3 templates em vez de 5+)

### 3.2 Menu de Ajuda Simplificado (getHelpMenu)

Remover do menu:
- Secao "Contas Fixas/Recorrentes" (removemos do UI)
- Secao "Agenda - Comandos Inteligentes" (removemos agendamento)
- Secao "Editar Compromissos"
- Secao "Cancelar Compromissos"

Menu final simplificado:
```
FALE NATURALMENTE:
- "gastei 50 no mercado"
- "recebi 500 de freelance"
- "qual meu saldo?"

ADICIONAR TRANSACOES:
- "gasto 50 mercado"
- "receita 1000 salario"
- "+100 freelance"
- "-30 lanche"

ENVIAR NOTA FISCAL:
- Tire foto e envie aqui

CONSULTAS:
- "saldo" - saldo atual
- "hoje" - relatorio do dia
- "semana" - ultimos 7 dias
- "relatorio" - mensal

EDITAR/EXCLUIR:
- "editar ultima"
- "excluir ultima"
```

### 3.3 Mensagens de Erro Melhores

Atualizar fallback de mensagem nao compreendida (no final do processMessage):
- De: mensagem generica
- Para: "Nao entendi direito. Tente assim: 'gastei 30 no mercado' ou 'saldo'"
- Sempre sugerir formato correto

### 3.4 Comando "gastos" como atalho

Adicionar deteccao de "gastos" como sinonimo de relatorio mensal de despesas (ja existe parcialmente via NLP, mas adicionar como comando direto).

---

## Arquivos a Alterar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/dashboard/SummaryCards.tsx` | Remover card assinatura, adicionar subtitulos, simplificar para 3 cards |
| `src/components/FinancialChart.tsx` | Remover grafico de barras, titulo mais claro, tooltip melhorado |
| `src/components/dashboard/DashboardContent.tsx` | Dashboard: 5 transacoes + link "ver todas"; Transactions: filtros simplificados |
| `src/components/TransactionFilters.tsx` | Remover fonte, categorias, periodos complexos, date range |
| `src/components/TransactionList.tsx` | Datas amigaveis, remover badge source, estados vazios melhores |
| `supabase/functions/whatsapp-agent/index.ts` | Help menu simplificado, respostas mais claras, erro melhor |
| `src/locales/pt-BR.json` | Novas chaves e atualizacoes |
| `src/locales/en-US.json` | Novas chaves e atualizacoes |
| `src/locales/es-ES.json` | Novas chaves e atualizacoes |
| `src/locales/pt-PT.json` | Novas chaves e atualizacoes |
| `src/locales/it-IT.json` | Novas chaves e atualizacoes |

## O que NAO sera alterado

- Banco de dados (nenhuma tabela ou coluna)
- Logica de autenticacao WhatsApp
- Edge functions alem do whatsapp-agent
- Componentes de admin
- Pagina de Relatorios (ReportsPage) - os graficos por categoria continuam la
- Hook useTransactions

