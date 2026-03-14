

## Correções de Navegação e Revisão Geral do Dashboard

### Bug Principal: "Ver todas as transações" não funciona

**Causa**: Em `DashboardContent.tsx` (linha 201), o botão dispara `window.dispatchEvent(new CustomEvent('switchTab', ...))`, mas **nenhum componente escuta esse evento**. O `FinancialDashboard.tsx` gerencia `currentTab` via `useState` — não há `addEventListener` para `switchTab`.

**Correção**: O `DashboardContent` já recebe os dados necessários mas não tem acesso ao `onTabChange`. A solução mais limpa é:
- Adicionar prop `onTabChange` ao `DashboardContentProps`
- Passar `setCurrentTab` (ou `handleTabChange`) do `FinancialDashboard` para `DashboardContent`
- Substituir o `window.dispatchEvent` por `onTabChange('transactions')` diretamente
- Remover o código do custom event morto

### Outros Problemas Detectados

**2. Moeda hardcoded "R$"** — Em `SummaryCards.tsx` (linha 26) e provavelmente em outros componentes, o símbolo `R$` e o formato `pt-BR` estão fixos. Ao usar outro idioma, a moeda deveria se adaptar (ou pelo menos ser configurável). Isso é menor mas inconsistente com o esforço de i18n.

**3. Sidebar sem item WhatsApp** — A sidebar (`AppSidebar.tsx`) não inclui o item "WhatsApp" nos itens de navegação, apesar de `DashboardContent` ter um handler para `currentTab === "whatsapp"`. O usuário só consegue acessar por outro caminho (se existir). Isso pode ser intencional, mas vale confirmar.

### Arquivos Afetados

- `src/components/dashboard/DashboardContent.tsx` — adicionar prop `onTabChange`, remover custom event
- `src/components/FinancialDashboard.tsx` — passar `onTabChange` ao `DashboardContent`

### Implementação

1. Adicionar `onTabChange: (tab: string) => void` à interface `DashboardContentProps`
2. No `FinancialDashboard.tsx`, passar `onTabChange={handleTabChange}` (mobile) e `onTabChange={setCurrentTab}` (desktop) ao `DashboardContent`
3. Em `DashboardContent.tsx`, substituir `handleViewAllTransactions` por `onTabChange('transactions')`
4. Remover o `CustomEvent` não utilizado

