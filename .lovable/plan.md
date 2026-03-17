

## Correção do GoalModal e Revisão de Bugs Restantes

### Bug Principal: GoalModal não carrega dados ao editar

**Causa**: `GoalModal.tsx` usa `useState(editingGoal?.categoryId || "")` na linha 21-22. O `useState` só executa o valor inicial na **primeira montagem**. Como o componente é renderizado uma vez e reutilizado, quando o usuário clica "Editar", o `editingGoal` muda mas o state não atualiza.

**Correção**: Adicionar `useEffect` para sincronizar `categoryId` e `amount` quando `editingGoal` ou `open` mudam (mesmo padrão usado no `EditTransactionModal` e `RecurringTransactionForm`).

### Outros Bugs Detectados

**2. RecurringTransactionForm não traduz categorias** — Linha 175: `{cat.name}` exibe nome do banco sem `translateCategoryName()`.

**3. TransactionFilters labels confusos** — O header diz "Filtrar conversas" e os labels dizem "Tipo de conversa", "Buscar na conversa", "Todas as conversas". Parece cópia de um chat, não de transações financeiras. Deveria ser "Filtrar transações", "Tipo de transação", etc.

**4. EditTransactionModal sugestão não traduzida** — Linha 179: `{ name: categories.find(c => c.id === suggestedCategory)?.name }` exibe nome cru do banco na sugestão de categoria.

### Arquivos Afetados (4)

1. `src/components/dashboard/GoalModal.tsx` — adicionar useEffect para sincronizar state
2. `src/components/RecurringTransactionForm.tsx` — traduzir categorias no dropdown
3. `src/components/TransactionFilters.tsx` — corrigir labels de "conversas" para "transações"
4. `src/components/EditTransactionModal.tsx` — traduzir nome na sugestão de categoria

