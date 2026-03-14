

## Traduzir Nomes das Categorias Padrão

### Problema
Os nomes das categorias são dados do banco de dados, gravados em português quando o usuário é criado. Por isso, ao trocar o idioma, "Alimentação", "Transporte", etc. continuam em português — não são strings da UI, são dados armazenados.

### Solução
Criar um mapeamento client-side das categorias padrão para chaves i18n. Na hora de **exibir** o nome, o sistema verifica se é uma categoria padrão conhecida e mostra a tradução; caso contrário, mostra o nome original (categorias criadas pelo usuário).

### Implementação

**1. Criar helper de tradução de categorias** (`src/lib/categoryTranslations.ts`):
- Mapa das 12 categorias padrão para chaves i18n:
  - `Alimentação` → `defaultCategories.food`
  - `Transporte` → `defaultCategories.transport`
  - `Moradia` → `defaultCategories.housing`
  - `Saúde` → `defaultCategories.health`
  - `Entretenimento` → `defaultCategories.entertainment`
  - `Educação` → `defaultCategories.education`
  - `Vestuário` → `defaultCategories.clothing`
  - `Outros` → `defaultCategories.other`
  - `Salário` → `defaultCategories.salary`
  - `Freelance` → `defaultCategories.freelance`
  - `Investimentos` → `defaultCategories.investments`
  - `Projetos` → `defaultCategories.projects`
- Função `translateCategoryName(name: string, t: TFunction): string` que retorna a tradução se existir no mapa, senão retorna o nome original.

**2. Adicionar chaves `defaultCategories.*` nos 5 locales**:
| Chave | pt-BR | en-US | es-ES | it-IT | pt-PT |
|---|---|---|---|---|---|
| food | Alimentação | Food | Alimentación | Alimentazione | Alimentação |
| transport | Transporte | Transport | Transporte | Trasporto | Transporte |
| housing | Moradia | Housing | Vivienda | Alloggio | Habitação |
| health | Saúde | Health | Salud | Salute | Saúde |
| entertainment | Entretenimento | Entertainment | Entretenimiento | Intrattenimento | Entretenimento |
| education | Educação | Education | Educación | Istruzione | Educação |
| clothing | Vestuário | Clothing | Vestuario | Abbigliamento | Vestuário |
| other | Outros | Other | Otros | Altri | Outros |
| salary | Salário | Salary | Salario | Stipendio | Salário |
| freelance | Freelance | Freelance | Freelance | Freelance | Freelance |
| investments | Investimentos | Investments | Inversiones | Investimenti | Investimentos |
| projects | Projetos | Projects | Proyectos | Progetti | Projetos |

**3. Usar `translateCategoryName` nos componentes que exibem nomes de categoria**:
- `CategoryManager.tsx` — lista de categorias
- `TransactionList.tsx` — badges de categoria nas transações
- `TransactionForm.tsx` — dropdown de seleção de categoria
- `EditTransactionModal.tsx` — dropdown de seleção de categoria
- `TransactionFilters.tsx` — filtro por categoria
- `ReportsPage.tsx` — gráficos por categoria (se aplicável)

**4. Atualizar emoji mapping em `TransactionList.tsx`**:
- O `getCategoryIcon` também usa nomes em português hardcoded para mapear emojis. Atualizar para verificar tanto o nome original quanto o traduzido, ou usar as chaves do mapa.

### Arquivos Afetados
- `src/lib/categoryTranslations.ts` (novo)
- `src/components/CategoryManager.tsx`
- `src/components/TransactionList.tsx`
- `src/components/TransactionForm.tsx`
- `src/components/EditTransactionModal.tsx`
- `src/components/TransactionFilters.tsx`
- `src/locales/pt-BR.json`, `en-US.json`, `es-ES.json`, `it-IT.json`, `pt-PT.json`

