

## Sistema de Metas Mensais - Dona Wilma

### Abordagem

Em vez de adicionar `monthly_goals` na tabela `profiles` (que mistura concerns), criarei uma tabela dedicada `monthly_goals` para manter o schema limpo e permitir queries eficientes. O cálculo de progresso será feito no frontend usando as transações já carregadas.

---

### PARTE 1: Backend (Supabase)

**Nova tabela `monthly_goals`:**
```sql
CREATE TABLE public.monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category_id)
);

ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
-- RLS: users can CRUD own goals, org members can view
```

Não criarei uma função SQL `calculate_goal_progress` — o cálculo será feito no frontend com as transações do mês atual que já estão carregadas em memória (evita round-trip desnecessário ao DB).

---

### PARTE 2: Frontend

**Novo hook `useMonthlyGoals`:**
- Fetch/create/update/delete goals da tabela `monthly_goals`
- Calcula progresso comparando com transações do mês atual por `category_id`

**Novo componente `MonthlyGoalsSection`:**
- Grid de cards por categoria com meta definida
- Progress bar colorida (verde 0-70%, amarelo 70-90%, vermelho 90%+)
- Badge vermelho quando >90%
- Tooltip com "Você já gastou R$X de R$Y"
- Botão "Definir Meta" abre modal

**Novo componente `GoalModal`:**
- Select com categorias de despesa existentes
- Input numérico para valor da meta
- Salva/atualiza na tabela `monthly_goals`

**Integração no Dashboard:**
- Adicionar item "Metas" (🎯) no `AppSidebar`
- Adicionar case `goals` no `DashboardContent`
- Adicionar na tab title map do `FinancialDashboard`

**i18n:** Adicionar chaves `goals.*` nos 5 arquivos de locale.

---

### PARTE 3: WhatsApp (Não incluído)

A integração do comando "metas" no WhatsApp agent requer modificar a edge function `whatsapp-agent/index.ts` que tem lógica complexa de NLP. Isso será uma etapa separada após o frontend estar funcionando.

---

### Arquivos a criar/modificar:
1. **Migration SQL** — tabela `monthly_goals` + RLS + trigger updated_at
2. **`src/hooks/useMonthlyGoals.ts`** — CRUD + cálculo de progresso
3. **`src/components/dashboard/MonthlyGoalsSection.tsx`** — UI principal
4. **`src/components/dashboard/GoalModal.tsx`** — Modal criar/editar meta
5. **`src/components/AppSidebar.tsx`** — Adicionar item "Metas"
6. **`src/components/FinancialDashboard.tsx`** — Tab title map
7. **`src/components/dashboard/DashboardContent.tsx`** — Case `goals`
8. **5 arquivos de locale** — Chaves de tradução

