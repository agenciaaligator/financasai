

## Revisão Completa do Sistema — Bugs, Lógica e Usabilidade

### 1. BUG: Moeda "R$" hardcoded em 6 componentes (quebra i18n)

Todos esses arquivos usam `R$ ` + `toLocaleString('pt-BR', ...)` ao invés de `Intl.NumberFormat` com locale dinâmico:

| Arquivo | Ocorrências |
|---|---|
| `SummaryCards.tsx` | 3x (saldo, receita, despesa) |
| `FilteredSummaryCards.tsx` | 3x (saldo, receita, despesa) |
| `TransactionList.tsx` | 1x (valor da transação) |
| `FinancialChart.tsx` | 1x (tooltip do gráfico) |
| `ReportsPage.tsx` | 1x (YAxis do bar chart: `R$${v}`) |
| `MonthlyGoalsSection.tsx` | formatCurrency hardcoded `pt-BR`/`BRL` |

**Correção**: Criar um helper `formatCurrency(value, language)` centralizado usando `Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'BRL' })` e substituir em todos os componentes. A moeda continua BRL (produto brasileiro), mas o formato numérico respeita o locale (1.000,00 vs 1,000.00).

---

### 2. BUG: Toasts do `useTransactions.ts` 100% hardcoded em português

Linhas 130-131, 201-203, 218-219, 225-228 possuem textos como:
- "Erro de conexão", "Não foi possível carregar transações"
- "Transação adicionada!", "Receita de R$..."
- "Erro ao excluir transação", "A transação foi removida"
- "Erro ao adicionar transação"

**Correção**: O hook não tem acesso direto ao `useTranslation` (hooks custom podem usar), mas é mais limpo passar `t` via parâmetro ou usar `i18n.t()` importado diretamente. Usar `useTranslation()` dentro do hook (é válido em React hooks).

---

### 3. RELATÓRIOS: Apenas filtro por mês, sem filtros avançados

A aba Relatórios só tem um seletor de mês. A aba Transações tem filtros de período (Todos/Hoje/Semana/Mês/Último mês), tipo (Receita/Despesa) e busca por texto. Os relatórios deveriam ter:

**Correção — Adicionar filtros à ReportsPage**:
- **Filtro por tipo**: Mostrar dados de receita, despesa ou ambos
- **Filtro por categoria**: Selecionar categorias específicas para análise
- **Período personalizado**: Além do mês, permitir "Últimos 3 meses", "Últimos 6 meses", "Este ano", "Todo período"
- **Busca por texto**: Filtrar transações por título/descrição antes de calcular os resumos
- Adicionar um card de "Resumo do Período" com contagem de transações, ticket médio, maior receita, maior despesa

---

### 4. RELATÓRIOS: Dados insuficientes para análise

Atualmente os relatórios mostram apenas dados de 1 mês selecionado. Para um lançamento, adicionar:

- **Evolução anual**: Gráfico de linha com receitas vs despesas dos últimos 12 meses (não apenas 3)
- **Média mensal**: Card com receita média, despesa média e saldo médio dos últimos N meses
- **Top categorias de receita**: Atualmente só mostra top 5 de despesas. Mostrar também top categorias de receita
- **Tabela detalhada por categoria**: Lista todas as categorias com valor total, quantidade de transações, percentual do total e variação vs mês anterior

---

### 5. BUG: GoalModal não traduz nomes de categorias

Em `GoalModal.tsx` (linha 61), exibe `{cat.name}` direto do banco, sem `translateCategoryName()`.

**Correção**: Importar e usar `translateCategoryName` no dropdown de categorias.

---

### 6. BUG: MonthlyGoalsSection não traduz nome da categoria

Em `MonthlyGoalsSection.tsx` (linha 129), `{gp.categoryName}` vem direto do hook sem tradução.

**Correção**: Aplicar `translateCategoryName` ao exibir o nome da categoria nos cards de metas.

---

### 7. USABILIDADE: Sidebar sem link para WhatsApp

A sidebar (`AppSidebar.tsx`) não inclui um item para a aba "WhatsApp", apesar de `DashboardContent` ter `currentTab === "whatsapp"`. O usuário não consegue acessar facilmente.

**Correção**: Adicionar item WhatsApp na sidebar, com emoji 📱 e descrição traduzida.

---

### 8. BUG: FilteredSummaryCards não traduz nomes de categorias

Em `FilteredSummaryCards.tsx` (linha 105), `{cat.name}` exibe o nome original do banco.

**Correção**: Aplicar `translateCategoryName`.

---

### 9. USABILIDADE: TransactionForm label hardcoded "(R$)"

Linha 162: `{t('transactions.amount', 'Valor')} (R$)` — o "(R$)" está fora da tradução.

**Correção**: Mover para dentro da chave i18n ou usar o símbolo de moeda dinâmico.

---

### Resumo dos Arquivos Afetados (15 arquivos)

1. `src/components/dashboard/SummaryCards.tsx` — formatCurrency dinâmico
2. `src/components/dashboard/FilteredSummaryCards.tsx` — formatCurrency + traduzir categorias
3. `src/components/TransactionList.tsx` — formatCurrency dinâmico
4. `src/components/FinancialChart.tsx` — formatCurrency dinâmico
5. `src/components/ReportsPage.tsx` — YAxis dinâmico + filtros avançados + mais dados
6. `src/components/dashboard/MonthlyGoalsSection.tsx` — formatCurrency dinâmico + traduzir categoria
7. `src/components/dashboard/GoalModal.tsx` — traduzir categorias
8. `src/components/TransactionForm.tsx` — label "(R$)" dinâmico
9. `src/components/AppSidebar.tsx` — adicionar item WhatsApp
10. `src/hooks/useTransactions.ts` — internacionalizar toasts
11. `src/locales/pt-BR.json` — novas chaves (relatórios avançados, toasts)
12. `src/locales/en-US.json` — traduções
13. `src/locales/es-ES.json` — traduções
14. `src/locales/it-IT.json` — traduções
15. `src/locales/pt-PT.json` — traduções

### Prioridade de Implementação

1. **Alta**: Bugs de i18n (moeda hardcoded, toasts, categorias não traduzidas) — itens 1, 2, 5, 6, 7, 8, 9
2. **Alta**: Relatórios avançados com filtros e mais dados — itens 3, 4
3. **Média**: WhatsApp na sidebar — item 7

