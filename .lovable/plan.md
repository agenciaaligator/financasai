

# Fluxo Stripe-First Seguro e Sem Duplicidade

## Resumo das Mudancas

Substituir o fluxo atual (createUser + resetPasswordForEmail) por `inviteUserByEmail()`, adicionar validacao inteligente de usuarios existentes, e criar rota `/set-password`.

## Mudancas Detalhadas

### 1. `supabase/functions/stripe-webhook/index.ts`

Reescrever a logica do `checkout.session.completed` e `customer.subscription.created`:

**Antes:**
- `admin.createUser()` com senha temporaria
- `resetPasswordForEmail()` para enviar email

**Depois:**
- Buscar usuario com `admin.listUsers()` (ja existe)
- Se NAO existir: usar `admin.inviteUserByEmail()` com `redirectTo: https://donawilma.lovable.app/set-password`
- Se JA existir:
  - Verificar assinatura em `user_subscriptions`
  - Se ativa: apenas atualizar `stripe_customer_id` se necessario, NAO enviar email
  - Se cancelada/expirada: reativar assinatura, atualizar registro
- Manter idempotencia (check por `stripe_subscription_id`)
- Remover toda referencia a `resetPasswordForEmail`
- Corrigir URL do SITE_URL para `https://donawilma.lovable.app`

A mesma logica sera aplicada ao handler `customer.subscription.created` (linhas 396-573).

### 2. `supabase/functions/custom-auth-emails/index.ts`

Atualizar para tratar o tipo `invite` (que e o tipo enviado por `inviteUserByEmail`):

- Adicionar funcao `generateInviteEmail()` com o mesmo design profissional do recovery
- Assunto: "Sua conta Dona Wilma foi criada -- Defina sua senha"
- Link apontando para `/set-password` com token
- Manter tratamento de `recovery` para cenario de "Esqueci minha senha" real

### 3. `src/App.tsx`

Adicionar rota `/set-password` como alias para `ResetPassword`:

```
<Route path="/set-password" element={<ResetPassword />} />
```

### 4. `src/pages/ResetPassword.tsx`

Adicionar deteccao da rota atual para ajustar textos:
- Se `/set-password`: usar textos de "Definir senha" (novo usuario)
- Se `/reset-password`: usar textos de "Redefinir senha" (usuario existente)

### 5. `src/pages/PaymentSuccess.tsx`

Adicionar terceiro estado para usuario existente com assinatura ativa:
- Detectar via query param `?existing=true` (passado pela URL de retorno do Stripe)
- Mostrar: "Este email ja possui uma assinatura ativa. Faca login para acessar sua conta."
- Botao: "Ir para o Login"

### 6. `supabase/functions/create-checkout/index.ts`

Atualizar `success_url` para incluir parametro quando usuario ja existe:
- URL padrao: `{origin}/payment-success`
- Nao requer mudanca aqui pois o parametro sera baseado no estado do webhook

Na verdade, o Stripe success_url e estatico. A deteccao de "usuario ja ativo" sera feita no PaymentSuccess via `check-subscription` que ja e chamado la.

### 7. `src/pages/PaymentSuccess.tsx` (deteccao inteligente)

Em vez de query param, usar logica no proprio componente:
- Se usuario logado E ja tem assinatura ativa: mostrar mensagem "Ja possui assinatura"
- Se usuario logado sem assinatura: redirecionar para `/boas-vindas`
- Se usuario novo (sem sessao): mostrar "Verifique seu email para definir senha"

### 8. Internacionalizacao

Adicionar chaves i18n para os novos textos:
- `paymentSuccess.alreadyActive` / `paymentSuccess.alreadyActiveSubtitle`
- `resetPassword.setPasswordTitle` / `resetPassword.setPasswordSubtitle`

Em todos os 5 locales.

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/stripe-webhook/index.ts` | Substituir createUser por inviteUserByEmail, adicionar validacao de usuario existente |
| `supabase/functions/custom-auth-emails/index.ts` | Adicionar handler para tipo `invite` |
| `src/App.tsx` | Adicionar rota `/set-password` |
| `src/pages/ResetPassword.tsx` | Detectar rota para ajustar textos |
| `src/pages/PaymentSuccess.tsx` | Adicionar estado para usuario com assinatura ativa |
| `src/locales/pt-BR.json` | Novas chaves i18n |
| `src/locales/en-US.json` | Novas chaves i18n |
| `src/locales/es-ES.json` | Novas chaves i18n |
| `src/locales/it-IT.json` | Novas chaves i18n |
| `src/locales/pt-PT.json` | Novas chaves i18n |

## O que NAO muda

- `check-subscription`: ja verifica `status: active` corretamente
- Logica de roles (master/admin protegidos)
- Fluxo do Stripe Checkout
- `create-checkout`: permanece igual
- `customer-portal`: permanece igual

## Fluxo Final

```text
Checkout Stripe
      |
      v
stripe-webhook recebe checkout.session.completed
      |
      +-- Usuario NAO existe?
      |     |
      |     v
      |   inviteUserByEmail(redirectTo: /set-password)
      |     |
      |     v
      |   custom-auth-emails envia email "Definir senha"
      |     |
      |     v
      |   Usuario clica link -> /set-password -> define senha -> /boas-vindas
      |
      +-- Usuario JA existe + assinatura ATIVA?
      |     |
      |     v
      |   Apenas atualiza stripe_customer_id
      |   PaymentSuccess mostra "Ja possui assinatura, faca login"
      |
      +-- Usuario JA existe + assinatura CANCELADA?
            |
            v
          Reativa assinatura, atualiza role para premium
          PaymentSuccess mostra "Assinatura reativada, faca login"
```

