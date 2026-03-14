

## Corrigir Traduções Faltantes no Dashboard

### Problemas Identificados

1. **Meses em português fixo no código** (`TransactionList.tsx` linha 99): Os nomes dos meses estão hardcoded como `['jan', 'fev', 'mar', ...]` — sempre aparecem em português independente do idioma selecionado.

2. **Chave `transactionList.yourConversations` ausente** em todos os 5 locales: O título "Suas conversas financeiras" na aba Transações nunca traduz porque a chave não existe nos arquivos JSON.

3. **Chave `filters.allConversations` ausente** em todos os 5 locales: O dropdown de filtro "Todas as conversas" também não traduz.

### Correções

**`src/components/TransactionList.tsx`** — Substituir meses hardcoded por tradução i18n:
- Linha 99-100: Trocar o array fixo de meses por `t('months.jan')`, `t('months.feb')`, etc., ou usar a API `Intl.DateTimeFormat` com o locale atual do i18n para formatar automaticamente (abordagem preferida, sem precisar de 12 chaves extras).
- Usar `new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(transactionDate)` para gerar "5 de mar" / "5 mar" / "Mar 5" conforme o idioma.

**Todos os 5 locales** — Adicionar chaves faltantes:

| Chave | pt-BR | en-US | es-ES | it-IT | pt-PT |
|---|---|---|---|---|---|
| `transactionList.yourConversations` | Suas conversas financeiras | Your financial conversations | Tus conversaciones financieras | Le tue conversazioni finanziarie | As suas conversas financeiras |
| `filters.allConversations` | Todas as conversas | All conversations | Todas las conversaciones | Tutte le conversazioni | Todas as conversas |

### Arquivos Afetados
- `src/components/TransactionList.tsx`
- `src/locales/pt-BR.json`
- `src/locales/en-US.json`
- `src/locales/es-ES.json`
- `src/locales/it-IT.json`
- `src/locales/pt-PT.json`

