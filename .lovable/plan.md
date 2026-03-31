

## Correção: Layout do Formulário de Nova Transação

### Problema

Ao clicar em "Nova Transação" na sidebar, o formulário abre inline acima do conteúdo da aba atual (ex: Transações), resultando em layout confuso — o formulário e a lista de transações competem pelo espaço, especialmente em viewports menores (~948px) onde a sidebar ocupa parte da tela.

### Causa

Em `FinancialDashboard.tsx`, o `showForm` renderiza o `TransactionForm` **acima** do `DashboardContent` sem mudar a aba para "dashboard". O conteúdo da aba corrente (transações, metas, etc.) continua visível abaixo do formulário.

### Solução

Quando o usuário clica "Nova Transação":
1. Mudar a aba para "dashboard" automaticamente (`setCurrentTab('dashboard')`)
2. Mostrar o formulário somente na aba dashboard
3. Isso garante que o formulário tenha o espaço completo sem conflito com outras abas

### Alteração

**`src/components/FinancialDashboard.tsx`** — Na função `onToggleForm` passada ao `AppSidebar`, adicionar `setCurrentTab('dashboard')` quando o form é aberto:

```typescript
// Desktop (linha ~177)
onToggleForm={() => {
  if (!showForm) setCurrentTab('dashboard');
  setShowForm(!showForm);
}}

// Mobile (linha ~102, dentro do Sheet)
onToggleForm={() => {
  if (!showForm) {
    setCurrentTab('dashboard');
  }
  setShowForm(!showForm);
  setMobileMenuOpen(false);
}}
```

Isso resolve o problema: o formulário sempre abre na aba dashboard, onde há espaço e contexto adequado (cards de resumo + formulário).

