

# Correcao Definitiva: Bloqueio de Duplicidade + URLs Corretas

## Resumo

Tres correcoes criticas: (1) normalizar email e adicionar UNIQUE constraints para impedir duplicatas, (2) corrigir fallback URL no create-checkout, (3) corrigir redirectTo no invite para usar /auth/callback.

---

## 1. Migracao SQL: UNIQUE constraints

Adicionar constraints para garantir integridade no banco:

```sql
-- Garantir unicidade de user_id em profiles
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Garantir unicidade de user_id em user_subscriptions  
ALTER TABLE public.user_subscriptions 
  ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);
```

Isso impede fisicamente que o webhook crie registros duplicados, mesmo em cenarios de race condition.

---

## 2. stripe-webhook: Normalizar email

Adicionar normalizacao no inicio da funcao `handleUserAndSubscription`:

```typescript
const email = customerEmail.toLowerCase().trim();
```

E usar `email` (normalizado) em todas as chamadas subsequentes (getUserByEmail, inviteUserByEmail). Atualmente o webhook ja usa getUserByEmail corretamente, mas sem normalizacao.

Tambem alterar o `redirectTo` de `/set-password` para `/auth/callback` para que o Supabase envie o token de sessao para a rota de callback que detecta e redireciona corretamente.

---

## 3. create-checkout: Corrigir fallback URL

Linha 72 atual:
```typescript
const origin = req.headers.get("origin") || "https://financasai.lovable.app";
```

Corrigir para:
```typescript
const origin = req.headers.get("origin") || "https://donawilma.lovable.app";
```

O dominio antigo `financasai.lovable.app` esta incorreto.

---

## 4. Configuracao manual do Supabase Dashboard

Acoes que voce precisa fazer manualmente:

- **Authentication - URL Configuration - Site URL**: `https://donawilma.lovable.app`
- **Redirect URLs** (adicionar todas):
  - `https://donawilma.lovable.app/**`
  - `https://donawilma.lovable.app/auth/callback`
  - `https://donawilma.lovable.app/set-password`

---

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | UNIQUE constraints em `profiles.user_id` e `user_subscriptions.user_id` |
| `supabase/functions/stripe-webhook/index.ts` | Normalizar email + redirectTo para `/auth/callback` |
| `supabase/functions/create-checkout/index.ts` | Corrigir fallback URL para `donawilma.lovable.app` |

## O que ja esta correto e NAO muda

- `AuthCallback.tsx`: ja detecta sessao e redireciona baseado em `password_set`
- `PaymentSuccess.tsx`: ja mostra mensagens corretas para novo usuario vs existente
- `ResetPassword.tsx`: ja atualiza `password_set = true`
- `useSubscriptionGuard.ts`: ja protege rotas
- Supabase client: ja tem `detectSessionInUrl: true`

