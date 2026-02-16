
# Revisao Completa do Onboarding - Problemas e Correcoes

## Diagnostico Completo

Tracei todo o fluxo do usuario `adwords@aligator.com.br` e encontrei **3 problemas criticos**:

### Problema 1: Formulario trava apos submit (Register.tsx)
**O que acontece**: Apos `signUp`, o Supabase envia email de confirmacao. O codigo tenta imediatamente chamar `create-checkout`, mas o usuario recebeu o email de confirmacao e pode nao ter sessao valida ainda. A chamada ao checkout pode travar ou falhar silenciosamente.

**Causa**: O `signUp` com confirmacao por email nao cria uma sessao autenticada. O usuario fica em estado "criado mas nao confirmado". O checkout e chamado com `userId` e `email` no body (sem token valido), o que funciona. Porem, o `window.location.href = checkoutData.url` redireciona para o Stripe e o usuario PERDE o contexto do loading state. O problema e que se o checkout demora, o usuario ve o botao travado em "Criando conta..." sem feedback visual adequado.

**Correcao**: Adicionar feedback visual claro de que o redirecionamento esta acontecendo e tratar o caso onde o email de confirmacao chega antes do usuario completar o checkout.

### Problema 2: Email de confirmacao redireciona para Home (nao para /payment-success)
**O que acontece**: O usuario clica no link do email de confirmacao e vai para a home (`/`). Como nao tem assinatura ativa (nunca completou o checkout no Stripe), ve "SUA ASSINATURA ESTA INATIVA".

**Causa raiz**: O Supabase Auth envia o link de confirmacao para o `SITE_URL` configurado (donawilma.lovable.app), que redireciona para `/`. O `AuthCallback.tsx` existe mas o email de confirmacao do Supabase nao usa essa rota - ele usa o redirect padrao do Supabase Auth.

**Dados no banco confirmam**:
- `user_subscriptions`: VAZIO para esse usuario (nunca completou checkout)
- `user_roles`: role = `free` (default criado pelo trigger)
- `profiles`: password_set = true (atualizado no registro)

O fluxo correto seria: apos confirmar email, o usuario deveria ser redirecionado para completar o pagamento, nao para o dashboard.

### Problema 3: "Regularizar assinatura" falha
**O que acontece**: Na tela de "Assinatura Inativa", o botao "Regularizar" chama `customer-portal`, que busca o cliente no Stripe por email. Como o usuario NUNCA completou o checkout, nao existe cliente no Stripe.

**Logs confirmam**: `[CUSTOMER-PORTAL] ERROR - "No Stripe customer found for this user"`

**Correcao**: Quando nao ha cliente Stripe, oferecer checkout direto em vez do portal.

---

## Plano de Correcao

### 1. Register.tsx - Melhorar feedback visual
- Mostrar mensagem clara de "Redirecionando para pagamento..." apos o signUp
- Se o checkout demorar, nao travar o formulario

### 2. SubscriptionInactive.tsx - Fallback para checkout quando nao ha cliente Stripe
Atualmente, o botao "Regularizar" so chama `customer-portal`, que falha se nao existe cliente. A correcao:
- Tentar `customer-portal` primeiro
- Se falhar com "No Stripe customer found", oferecer botao de checkout direto (`create-checkout`)
- Isso resolve o caso onde o usuario confirmou o email mas nunca pagou

### 3. Index.tsx (ProtectedDashboard) - Redirecionar para checkout quando usuario nao tem assinatura
Quando o usuario tem `password_set = true` mas `subscriptionStatus = 'inactive'` e nao tem `stripe_customer_id`, o sistema deveria oferecer opcao de ir para checkout em vez de so mostrar "Regularizar" (que nao funciona sem cliente Stripe).

### 4. AuthCallback.tsx - Apos confirmacao de email, verificar se tem assinatura
Apos confirmar email, checar se o usuario tem assinatura:
- Se tem: ir para dashboard/boas-vindas
- Se nao tem: ir para `/choose-plan` para completar o pagamento

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/SubscriptionInactive.tsx` | Adicionar fallback: se customer-portal falha, oferecer checkout direto |
| `src/pages/AuthCallback.tsx` | Apos confirmacao, checar assinatura e redirecionar para /choose-plan se nao tem |
| `src/pages/Register.tsx` | Melhorar feedback visual durante redirecionamento para Stripe |

---

## Detalhes Tecnicos

### SubscriptionInactive.tsx - Fallback para checkout
```typescript
const handleRegularize = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
      return;
    }
    // Se retornou erro de "No Stripe customer", oferecer checkout
    if (data?.error?.includes('No Stripe customer')) {
      throw new Error('no_customer');
    }
  } catch (err) {
    // Fallback: redirecionar para pagina de planos para fazer checkout
    navigate('/choose-plan');
    return;
  } finally {
    setLoading(false);
  }
};
```

### AuthCallback.tsx - Checar assinatura apos confirmacao
```typescript
// Apos confirmar password_set, verificar assinatura
const { data: sub } = await supabase
  .from('user_subscriptions')
  .select('status')
  .eq('user_id', session.user.id)
  .eq('status', 'active')
  .maybeSingle();

if (!sub) {
  // Sem assinatura ativa - ir para escolher plano
  navigate('/choose-plan', { replace: true });
} else {
  navigate('/boas-vindas', { replace: true });
}
```

### Register.tsx - Feedback visual
Adicionar estado intermediario "Redirecionando para pagamento..." com spinner apos o signUp ter sucesso, antes do redirect para Stripe.
