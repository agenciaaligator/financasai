

## Categorização Inteligente com Aprendizado - Dona Wilma

### Situação Atual
- **WhatsApp**: `AICategorizer` usa Gemini para categorizar, mas sem histórico pessoal. `CategoryMatcher.findBestCategory()` usa heurísticas de string matching + fallback IA.
- **Frontend**: `CategoryManager` permite CRUD de categorias. `EditTransactionModal` tem sugestão básica por correspondência de nome. `TransactionList` não tem quick-edit de categoria.
- **Sidebar**: Já tem "Categorias" no menu.
- Não existe tabela `user_category_patterns` nem sistema de aprendizado.

---

### PARTE 1: Backend (Supabase)

**Nova tabela `user_category_patterns`:**
```sql
CREATE TABLE public.user_category_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  keyword text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  confidence_score numeric DEFAULT 1,
  usage_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, keyword, category_id)
);
-- RLS: users CRUD own patterns
```

**Melhorar `AICategorizer.suggestCategoryWithAI()`:**
- Antes de chamar a IA, buscar padrões do usuário na tabela `user_category_patterns`
- Se encontrar match com confidence_score > 0.8, usar diretamente sem chamar IA (economia de tokens)
- Se chamar IA, incluir no prompt: "Este usuário tem os seguintes padrões: uber→Transporte, mercado→Alimentação..."

**Sistema de aprendizado no WhatsApp agent:**
- Quando usuário corrige categoria via WhatsApp ("não, é Transporte"), extrair keywords do título e salvar em `user_category_patterns`
- Incrementar `usage_count` e `confidence_score` em combinações repetidas

---

### PARTE 2: Frontend

**1. Hook `useCategoryPatterns`:**
- Fetch padrões do usuário
- Função `learnPattern(keyword, categoryId)` que faz upsert na tabela
- Função `suggestCategory(title)` que busca padrões locais antes de qualquer IA

**2. Quick-edit de categoria no `TransactionList`:**
- Click no badge de categoria abre um Popover com dropdown de categorias
- Ao mudar, salva via PATCH e chama `learnPattern()` com keywords do título
- Toast "✅ Padrão aprendido!" quando aprende nova associação

**3. Sugestões no `TransactionForm`:**
- Ao digitar título, buscar padrões aprendidos e mostrar sugestão inline
- "Baseado no seu histórico, sugerimos: Transporte" com botão para aceitar

**4. Widget "Categorias Mais Usadas" no dashboard:**
- Novo componente pequeno mostrando top 5 categorias por número de transações do mês
- Badge com contagem de transações sem categoria

**5. Melhorar `CategoryManager`:**
- Adicionar i18n (já está hardcoded em português)

---

### PARTE 3: i18n
Adicionar chaves `categories.*` nos 5 locales para todos os textos novos.

---

### Arquivos a criar/modificar:
1. **Migration SQL** — tabela `user_category_patterns` + RLS + trigger updated_at
2. **`src/hooks/useCategoryPatterns.ts`** — CRUD + sugestão local
3. **`src/components/TransactionList.tsx`** — Quick-edit categoria inline
4. **`src/components/TransactionForm.tsx`** — Sugestão ao digitar título
5. **`src/components/CategoryManager.tsx`** — i18n
6. **`supabase/functions/whatsapp-agent/index.ts`** — Padrões pessoais no prompt + aprendizado com correções
7. **5 arquivos de locale** — Chaves `categories.*`

