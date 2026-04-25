## Objetivo

1) Limpar todos os dados financeiros (despesas, receitas, recorrências, metas e alertas) do usuário admin `contato@aligator.com.br` (`user_id: 2efec051-aa64-4f31-8c1b-c22ac51d7d7b`), preservando a conta, perfil, organização, plano, papel admin, configurações de WhatsApp e categorias.

2) Confirmar como o sistema bloqueia cadastros com e-mail ou celular já existentes.

---

## Parte 1 — Limpeza de dados do admin

Volume atual encontrado no banco:

| Item | Quantidade |
|---|---|
| Transações | 114 |
| Transações recorrentes | 4 |
| Instâncias recorrentes | 0 |
| Metas mensais | 2 |
| Alertas de meta enviados | 8 |
| Categorias | 15 (preservadas) |

### O que será apagado (migration SQL)

Na ordem correta, respeitando dependências:

1. `goal_alerts_sent` do user_id → 8 registros
2. `monthly_goals` do user_id → 2 registros
3. `recurring_instances` ligadas às `recurring_transactions` do user_id → 0
4. `recurring_transactions` do user_id → 4 registros
5. `transactions` do user_id → 114 registros

### O que NÃO será tocado

- `auth.users`, `profiles`, `user_roles` (admin), `master_users`
- `organizations`, `organization_members`
- `user_subscriptions` (plano ativo)
- `categories` (mantém as 15 personalizadas + padrão)
- `whatsapp_sessions`, `whatsapp_settings` (sessão permanente preservada)
- `calendar_connections`, `work_hours`, `reminder_settings`, `commitments`

### Por que via migration e não app

Estas tabelas têm RLS por `user_id`/organização — não dá pra limpar em massa via UI. Migration garante atomicidade (tudo num transaction) e auditoria.

---

## Parte 2 — Validação de duplicidade no cadastro

**Resposta curta: sim, está bloqueado nas duas pontas (e-mail e celular).**

Verifiquei o fluxo em `src/pages/Register.tsx` (linhas 105–135) e as funções no banco:

### Camada 1 — Pré-check no frontend (antes do signUp)

Ao clicar em "Criar conta", o app chama em paralelo:

- `check_email_available(p_email)` → `SELECT NOT EXISTS (... FROM auth.users WHERE lower(email) = lower(trim(p_email)))`
- `check_phone_available(p_phone)` → compara apenas dígitos do telefone contra `profiles.phone_number` normalizado (regex remove `+`, espaços, parênteses, hífen)

Se qualquer um retornar `false`, o cadastro é bloqueado **antes** de criar usuário no Supabase, com toast localizado:

- E-mail duplicado → "Esse e-mail já tem conta. Faça login para acessar ou recupere sua senha."
- Telefone duplicado → mensagem equivalente para o telefone.

### Camada 2 — Banco de dados (defesa em profundidade)

- `auth.users.email` tem unique constraint nativa do Supabase (signUp falharia mesmo se o pré-check passasse).
- Trigger `handle_new_user_simple` captura `unique_violation` no telefone, registra evento em `security_events` (`signup_phone_duplicate_dropped`) e cria o profile sem o telefone — mas isso é fallback de segurança; na prática o pré-check do frontend já barra.

### Conclusão

Você pode rodar o checklist tranquilo. Tentar criar conta com `contato@aligator.com.br` ou com seu celular atual vai mostrar o erro e bloquear o cadastro.

---

## Detalhes técnicos

**Migration SQL a executar:**

```sql
DO $$
DECLARE
  v_uid uuid := '2efec051-aa64-4f31-8c1b-c22ac51d7d7b';
BEGIN
  DELETE FROM public.goal_alerts_sent WHERE user_id = v_uid;
  DELETE FROM public.monthly_goals WHERE user_id = v_uid;
  DELETE FROM public.recurring_instances
    WHERE recurring_transaction_id IN (
      SELECT id FROM public.recurring_transactions WHERE user_id = v_uid
    );
  DELETE FROM public.recurring_transactions WHERE user_id = v_uid;
  DELETE FROM public.transactions WHERE user_id = v_uid;
END $$;
```

Após aprovação do plano, eu rodo a migration e confirmo as contagens zeradas. Você abre o dashboard e começa a cadastrar suas despesas e receitas reais — o saldo, gráficos e relatórios partem do zero.