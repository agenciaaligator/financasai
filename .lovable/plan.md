

## Relatórios Mensais Avançados - Dona Wilma

### Situação Atual

- **Frontend**: `ReportsPage.tsx` já existe com cards de resumo, gráficos (linha, barra, pizza) e insights. Porém está 100% hardcoded em português, sem comparativo mensal, sem top 5 categorias destacado, e sem seletor de mês/ano específico.
- **WhatsApp**: O comando "relatório" já funciona via `generateSimpleReport()` (L3887-3972). Mostra receitas, despesas, saldo e últimas 5 transações, mas **não inclui top categorias nem comparativo com mês anterior**.
- **Sidebar**: "Relatórios" já está no sidebar (id: `reports`), e `DashboardContent` já renderiza `<ReportsPage />` no case `reports`.
- **Não há tabela nova necessária** — toda a lógica usa dados da tabela `transactions` existente.

### Plano de Implementação

**1. Reescrever `ReportsPage.tsx` com as features solicitadas:**

- Seletor de mês/ano (dropdown com últimos 12 meses) em vez do seletor de período genérico atual
- 4 cards de métricas: Receitas (verde), Despesas (vermelho), Saldo do Mês (condicional), Variação vs Mês Anterior (% + seta)
- Gráfico pizza: gastos por categoria (top 5) com cores da marca
- Gráfico barras: comparativo receitas vs despesas dos últimos 3 meses
- Seção "Top 5 Categorias" com lista, valor, percentual e emoji da categoria
- Glassmorphism style nos cards, cores da marca (#2B5B84, #E8B86D, #27AE60)
- Loading state, empty state, responsive mobile
- i18n em todos os textos

**2. Atualizar `generateSimpleReport()` no whatsapp-agent:**

Adicionar ao relatório WhatsApp existente:
- Comparativo com mês anterior (buscar transações do mês anterior, calcular diferença e %)
- Top 5 categorias com maiores gastos (com percentual)
- Formatar conforme o exemplo fornecido pelo usuário

**3. i18n:** Adicionar chaves `reports.*` nos 5 arquivos de locale.

### Arquivos a modificar:
1. `src/components/ReportsPage.tsx` — reescrever completamente
2. `supabase/functions/whatsapp-agent/index.ts` — atualizar `generateSimpleReport()`
3. 5 arquivos de locale — chaves de tradução para relatórios

### Sem mudanças necessárias:
- Sidebar (já tem "Relatórios")
- DashboardContent (já renderiza ReportsPage)
- FinancialDashboard tab title map (já tem "reports")
- Banco de dados (sem nova tabela/migration)

