

## Diagnóstico — redirect indo para Home em vez de /boas-vindas

### Evidência dos logs (timeline real do seu teste)

```
02:32:05  signup adwords@aligator.com.br ✅
02:32:07  GET /user → autenticado ✅
02:32:07  create-checkout → sessão criada ✅
02:32:57  Stripe webhook: checkout.session.completed ✅
02:32:57  Stripe webhook: invoice.paid → role = premium ✅
02:32:58  GET /admin/users → frontend buscou perfil ✅
```

Tudo no backend funcionou. O problema é **puramente no fluxo de redirect do frontend após o Stripe**. Você caiu em `/` (Home) em vez de `/payment-success` → `/boas-vindas`.

### Causa raiz provável

O Stripe redireciona para a `success_url` que `create-checkout` define. Preciso confirmar duas coisas no código (vou ler quando aprovar):

1. **`create-checkout/index.ts`**: qual URL exata é passada como `success_url`? Se for `${origin}/` ou `${origin}/payment-success?session_id=...` sem o path correto, ou se faltar o parâmetro que `/payment-success` espera, a página redireciona pra Home.

2. **`PaymentSuccess.tsx`**: o auto-redirect para `/boas-vindas` só dispara se `session && status?.subscribed`. Se você abriu o checkout em **nova aba** (que é o comportamento atual em `useCheckout.ts` — `window.open(data.url, '_blank')`), o Stripe redireciona a **nova aba** para success_url, mas você provavelmente fechou ela ou o Stripe redirecionou pra aba errada. A aba original ficou em `/escolher-plano` ou `/` e nunca viu o success.

### O bug estrutural que explica tudo

`useCheckout.ts` linha 41: **`window.open(data.url, '_blank')`** — abre Stripe em nova aba. Isso é a fonte do caos:

- Aba nova: vai pro Stripe → paga → redireciona pra `/payment-success` → mostra sucesso → tenta redirecionar pra `/boas-vindas`
- Aba original: continua em `/escolher-plano` parada, nunca recebe nada
- Se o usuário fecha a aba nova achando que terminou (comportamento natural), volta pra aba original que está perdida → ele clica em algo e cai em `/`

Isso **quebra completamente o onboarding linear** que sua memória `fluxo-onboarding-unificado-obrigatorio` exige.

### Solução

**1. Trocar `window.open(_, '_blank')` por `window.location.href = data.url`** em `useCheckout.ts`. Redirect na mesma aba é o padrão Stripe recomendado para onboarding linear. Elimina divergência de abas.

**2. Garantir que `success_url` em `create-checkout` aponte para `/payment-success?session_id={CHECKOUT_SESSION_ID}`** (verificar e corrigir se necessário).

**3. Adicionar fallback em `PaymentSuccess.tsx`**: se após 8 segundos a sessão ainda não estiver `subscribed`, fazer 1 retry de `refreshStatus()` antes de mostrar o estado amber. Isso cobre a janela onde o webhook ainda está processando.

**4. Verificar mobile**: o mesmo fix corrige mobile automaticamente, porque mobile **odeia popups/novas abas** (Safari iOS bloqueia `window.open` agressivamente — provavelmente quebraria 100% no celular).

### Plano de execução

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `src/hooks/useCheckout.ts` | Trocar `window.open(url, '_blank')` por `window.location.href = url`. Remover toast "Checkout aberto em nova aba". |
| 2 | `supabase/functions/create-checkout/index.ts` | Confirmar `success_url: ${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}` e `cancel_url: ${origin}/payment-cancelled` |
| 3 | `src/pages/PaymentSuccess.tsx` | Adicionar 1 retry automático de `refreshStatus()` após 5s se ainda não estiver `subscribed`, antes de cair no estado amber |
| 4 | Suavizar alerta amber (já solicitado antes) | Mensagem: "Aguardando confirmação do pagamento, isso leva poucos segundos..." com botão "Verificar novamente" |

### O que **não** vou fazer

- Não vou mexer em `stripe-webhook` (está funcionando — log confirma)
- Não vou mexer em `check-subscription` (está funcionando)
- Não vou mexer em `Welcome.tsx` / `WelcomeScreen.tsx` (chega lá quando o redirect funcionar)
- Não vou mexer em RLS, banco ou auth

### Resultado esperado após o fix

Desktop e mobile, mesmo fluxo:
```
/escolher-plano → [clica Assinar] → Stripe (mesma aba)
→ paga → /payment-success (3s loading)
→ /boas-vindas (welcome screen com nome)
→ [clica Continuar] → /dashboard ou WhatsApp connect
```

Sem nova aba, sem popup, sem perda de contexto, sem cair em `/`. Funciona em iOS Safari, Android Chrome, desktop — todos iguais.

