
# Fluxo Completo de Onboarding + Controle de Assinatura Stripe

## Resumo

Implementar controle obrigatorio de senha (password_set), protecao de rotas por status de assinatura, grace period de 3 dias para inadimplencia, e tela de bloqueio para assinaturas inativas. Tudo integrado ao webhook Stripe existente.

---

## 1. Adicionar campo `password_set` na tabela `profiles`

**Migracao SQL:**
```sql
ALTER TABLE profiles ADD COLUMN password_set boolean DEFAULT false;
```

No `stripe-webhook`, ao criar usuario via `inviteUserByEmail`, o trigger `handle_new_user_simple` ja cria o profile com os defaults -- portanto `password_set` sera `false` automaticamente.

---

## 2. Atualizar `ResetPassword.tsx` -- marcar `password_set = true`

Apos o usuario definir a senha com sucesso (`updatePassword`), atualizar o campo:

```typescript
await supabase.from('profiles').update({ password_set: true }).eq('user_id', user.id);
// Tambem atualizar user_metadata para redundancia
await supabase.auth.updateUser({ data: { password_set: true } });
```

Isso garante que o campo e marcado apos a definicao da senha, tanto em `/set-password` quanto em `/reset-password`.

---

## 3. Criar componente `RequireAuth` (protecao de rotas)

Novo arquivo: `src/components/RequireAuth.tsx`

Logica:
1. Se nao autenticado: redirecionar para `/` (landing com login)
2. Se autenticado mas `password_set !== true`: redirecionar para `/set-password`
3. Se autenticado mas assinatura inativa (sem grace period): mostrar tela de bloqueio
4. Se autenticado com assinatura ativa ou dentro do grace period: permitir acesso

---

## 4. Criar pagina `SubscriptionInactive.tsx`

Nova pagina: `src/pages/SubscriptionInactive.tsx`

Exibir:
- "Sua assinatura esta inativa"
- Status atual (cancelada, em atraso, suspensa)
- Botao "Regularizar assinatura" que abre o customer-portal
- Botao "Sair" para logout

---

## 5. Atualizar `App.tsx` -- protecao de rotas

Envolver a rota `/` (Index) e rotas autenticadas com `RequireAuth`:

```text
/                    -> RequireAuth > Index
/set-password        -> ResetPassword (sem protecao -- precisa estar acessivel)
/reset-password      -> ResetPassword (sem protecao)
/payment-success     -> PaymentSuccess (sem protecao)
/subscription-inactive -> SubscriptionInactive (sem protecao completa, mas requer auth)
```

---

## 6. Atualizar `Index.tsx` -- remover verificacao duplicada

O `Index.tsx` atualmente faz sua propria verificacao de auth. Com o `RequireAuth` envolvendo a rota, podemos simplificar: se o usuario chegou ao Index, ja esta autenticado, com senha definida e assinatura valida.

Manter a logica de landing page para usuarios nao autenticados (o RequireAuth permite isso condicionalmente).

Na verdade, manter a estrutura atual do Index (landing se nao logado, dashboard se logado) e aplicar RequireAuth apenas internamente no FinancialDashboard ou via wrapper condicional.

**Abordagem revisada:** Criar um wrapper `ProtectedDashboard` que aplica as verificacoes apenas quando o usuario esta logado, sem afetar a landing page publica.

---

## 7. Grace Period de 3 dias

No componente `RequireAuth` ou no hook `useSubscriptionGuard`:

```typescript
const isInGracePeriod = (subscription) => {
  if (subscription.status !== 'past_due') return false;
  const pastDueSince = new Date(subscription.updated_at);
  const graceDays = 3;
  const graceEnd = new Date(pastDueSince.getTime() + graceDays * 24 * 60 * 60 * 1000);
  return new Date() < graceEnd;
};
```

- Durante grace period: permitir acesso + alerta amarelo no topo
- Apos grace period: bloquear e redirecionar para `/subscription-inactive`

---

## 8. Criar componente `GracePeriodBanner.tsx`

Banner amarelo fixo no topo do dashboard:
- "Sua assinatura esta em atraso. Regularize para evitar bloqueio."
- Botao "Regularizar agora" -> customer-portal

---

## 9. Criar hook `useSubscriptionGuard.ts`

Centralizar toda a logica de verificacao:

```typescript
export function useSubscriptionGuard() {
  // Retorna:
  // - needsPassword: boolean
  // - subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'inactive'
  // - isInGracePeriod: boolean
  // - gracePeriodEndsAt: Date | null
  // - canAccessDashboard: boolean
  // - subscriptionEndDate: Date | null (para cancelados com acesso ate o fim)
}
```

Busca dados de `profiles.password_set` e `user_subscriptions` via Supabase.

---

## 10. Atualizar `stripe-webhook` -- cancelamento com acesso ate o fim do periodo

O handler `customer.subscription.deleted` ja salva `cancelled_at`. Garantir que `current_period_end` esta salvo corretamente para que o frontend permita acesso ate essa data.

Nenhuma mudanca necessaria no webhook -- ja funciona. A logica de "acesso ate o fim" sera no frontend via `useSubscriptionGuard`.

---

## 11. Card de Status da Assinatura no Dashboard

Adicionar no `DashboardContent.tsx` ou em `SummaryCards.tsx` um card mostrando:
- Status: Ativa / Cancelada (expira em X) / Em atraso / Suspensa
- Renovacao/Expiracao: data formatada
- Botao "Gerenciar assinatura" -> customer-portal

---

## 12. Atualizacao do `invoice.paid` no webhook

Atualizar para tambem restaurar a role para `premium` quando pagamento for confirmado (reativar apos inadimplencia):

```typescript
if (event.type === "invoice.paid") {
  // Atualizar status para active
  // Atualizar role para premium (se nao for master/admin)
  // Atualizar current_period_end
}
```

---

## 13. Internacionalizacao

Adicionar chaves i18n nos 5 locales para:
- `subscription.inactive` / `subscription.pastDue` / `subscription.cancelled`
- `subscription.gracePeriod` / `subscription.regularize`
- `subscription.status` / `subscription.renewsAt` / `subscription.expiresAt`
- `subscription.manageSubscription`

---

## Arquivos Modificados/Criados

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar `password_set` em `profiles` |
| `src/pages/ResetPassword.tsx` | Marcar `password_set = true` apos definir senha |
| `src/hooks/useSubscriptionGuard.ts` | **NOVO** - logica centralizada de protecao |
| `src/components/RequireAuth.tsx` | **NOVO** - wrapper de protecao de rotas |
| `src/components/GracePeriodBanner.tsx` | **NOVO** - banner de alerta para inadimplencia |
| `src/pages/SubscriptionInactive.tsx` | **NOVO** - tela de bloqueio |
| `src/App.tsx` | Integrar RequireAuth nas rotas |
| `src/pages/Index.tsx` | Integrar verificacao de password_set e subscription |
| `src/components/dashboard/SummaryCards.tsx` | Card de status da assinatura |
| `supabase/functions/stripe-webhook/index.ts` | Melhorar `invoice.paid` para restaurar role |
| `src/locales/*.json` (5 arquivos) | Novas chaves i18n |

## O que NAO muda

- `custom-auth-emails`: ja trata invite e recovery separadamente
- `check-subscription`: ja verifica status ativo
- `create-checkout`: permanece igual
- `customer-portal`: permanece igual
- Logica de master/admin: ja protegida no webhook

## Fluxo Final

```text
Usuario novo paga no Stripe
  -> stripe-webhook cria via inviteUserByEmail (password_set=false)
  -> Email chega: "Defina sua senha"
  -> Clica link -> /set-password
  -> Define senha -> password_set=true
  -> Redireciona para /boas-vindas
  -> Acessa dashboard normalmente

Usuario logado acessa /
  -> RequireAuth verifica:
     1. Autenticado? Sim
     2. password_set? Sim
     3. Assinatura ativa? Sim
     -> Mostra dashboard

Usuario com assinatura past_due (< 3 dias)
  -> Acessa dashboard com banner amarelo de alerta
  -> Clica "Regularizar" -> customer-portal

Usuario com assinatura past_due (> 3 dias)
  -> Bloqueado -> /subscription-inactive
  -> Botao "Regularizar" -> customer-portal

Usuario cancela assinatura
  -> Acessa dashboard ate current_period_end
  -> Apos data -> bloqueado -> /subscription-inactive

Pagamento renovado (invoice.paid)
  -> status volta para active
  -> role volta para premium
  -> Acesso restaurado automaticamente
```
