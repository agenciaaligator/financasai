

# Simplificar Menu Lateral e Remover Complexidades

## Resumo

Remover subitens de Transacoes (Lancamentos/Contas Fixas), remover "Novidades", e transformar "Transacoes" em item direto sem submenu. O menu final tera 6 itens flat (+ Admin para admins).

## Alteracoes

### 1. AppSidebar.tsx - Simplificar menu

**Remover**:
- Toda logica de submenu Collapsible (Lancamentos + Contas Fixas)
- Item "Novidades" (future)
- Estado `transactionsOpen` e imports `Collapsible`, `ChevronDown`, `Repeat`
- Chaves i18n `sidebar.lancamentos`, `sidebar.contasFixas`, `sidebar.future`, `sidebar.futureDesc`

**Menu final** (array `sidebarItemsLocal`):
1. Dashboard
2. Transacoes (item direto, sem submenu - vai para tab `transactions`)
3. Categorias
4. Relatorios
5. Perfil
6. Admin (condicional)

Tanto no bloco mobile quanto no desktop, "Transacoes" sera um botao simples igual aos outros itens.

### 2. DashboardContent.tsx - Remover tab recurring e future

- Remover bloco `if (currentTab === "recurring")` (linhas 434-439)
- Remover bloco `if (currentTab === "future")` (linhas 467-469)
- Remover import `RecurringTransactionsManager`
- Remover import `FutureFeatures`

### 3. DashboardTabs.tsx - Remover tabs recurring e future

- Remover `TabsTrigger` e `TabsContent` para `recurring` e `future`
- Remover imports `Repeat`, `Sparkles`, `RecurringTransactionsManager`, `FutureFeatures`
- Ajustar grid-cols de 7/8 para 5/6

### 4. Locales (5 arquivos) - Limpar chaves removidas

Remover chaves:
- `sidebar.lancamentos`
- `sidebar.contasFixas`
- `sidebar.future`
- `sidebar.futureDesc`

## Arquivos a alterar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/AppSidebar.tsx` | Remover submenu, item Novidades, simplificar para lista flat |
| `src/components/dashboard/DashboardContent.tsx` | Remover blocos recurring e future |
| `src/components/dashboard/DashboardTabs.tsx` | Remover tabs recurring e future, ajustar grid |
| `src/locales/pt-BR.json` | Remover chaves obsoletas |
| `src/locales/en-US.json` | Remover chaves obsoletas |
| `src/locales/es-ES.json` | Remover chaves obsoletas |
| `src/locales/pt-PT.json` | Remover chaves obsoletas |
| `src/locales/it-IT.json` | Remover chaves obsoletas |

## O que NAO sera alterado

- Os componentes `RecurringTransactionsManager`, `FutureFeatures` continuam existindo no codigo (nao serao deletados), apenas deixam de ser acessiveis pelo menu
- O hook `useRecurringTransactions` permanece intacto
- Nenhuma tabela no banco e alterada
- O formulario de transacao (`TransactionForm`) continua funcionando como esta (Receita/Despesa com Valor, Descricao, Categoria, Data)

