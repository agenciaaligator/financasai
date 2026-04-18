

## Auditoria do onboarding — 4 erros encontrados

Auditei o fluxo ponta a ponta (Index → ChoosePlan → Register → Stripe → PaymentSuccess → Welcome → Dashboard). O fluxo principal está sólido, mas encontrei **4 problemas reais** que precisam correção, em ordem de gravidade:

### 🔴 ERRO 1 — `useAuth.signUp()` está obsoleto e vulnerável
**Arquivo:** `src/hooks/useAuth.ts` (linhas 34-106)

A função `signUp` antiga ainda existe com mensagens hardcoded em português, sem i18n, sem pre-check de telefone, e sem o tratamento que adicionamos em `Register.tsx`. Se qualquer outro lugar do código chamar `useAuth().signUp(...)`, o usuário verá mensagens em português independente do idioma e sem proteção contra duplicatas.

**Correção:** Remover `signUp` de `useAuth.ts` (não é mais usado pelo onboarding) OU fazer com que apenas redirecione/sinalize uso indevido. Auditar todos os imports.

### 🔴 ERRO 2 — Welcome bloqueia botão "Começar a usar" se WhatsApp não conectado
**Arquivo:** `src/pages/Welcome.tsx` linha 378

`disabled={step !== 'connected'}` impede o usuário de pular a conexão WhatsApp. Se a Meta API falhar ou o usuário quiser configurar depois, ele fica preso para sempre nessa tela. Combinado com `Index.tsx` linha 553 que **força redirect de volta para `/boas-vindas` se não houver `whatsapp_sessions`**, cria um loop infinito.

**Correção:** Permitir "Pular por enquanto" (botão secundário). Em `Index.tsx`, redirecionar para `/boas-vindas` apenas **uma vez** (já existe `redirected_to_welcome` flag mas ela não é checada antes do redirect — só é setada). Adicionar checagem: `if (!whatsappSession && !sessionStorage.getItem('redirected_to_welcome'))`.

### 🟡 ERRO 3 — Race condition em `PaymentSuccess` quando vem de outra aba/desktop
**Arquivo:** `src/pages/PaymentSuccess.tsx`

Se o usuário pagou no celular e abriu o link de sucesso no desktop (sem sessão), cai no estado "Not logged in" (linha 124). Está OK, mas o botão leva para `/login` sem indicação de que o pagamento foi confirmado. Pode ser confuso.

**Correção menor:** Adicionar mensagem clara "Pagamento processado. Faça login com o e-mail usado no checkout para continuar."

### 🟡 ERRO 4 — `AuthCallback` redireciona usuário SEM assinatura para `/choose-plan`, mas Register exige `?plan=`
**Arquivo:** `src/pages/AuthCallback.tsx` linha 36

Cenário: usuário clica no link de confirmação de e-mail → AuthCallback verifica → não tem assinatura → manda pra `/choose-plan`. Tudo bem. **Mas** se ele recém-pagou e o webhook ainda não processou, vai pra `/choose-plan` em vez de aguardar. Pode pagar duas vezes.

**Correção:** Em `AuthCallback`, fazer 1 retry com 3s antes de decidir o destino. Se ainda sem sub, ir pra `/payment-success` (que tem retry próprio) em vez de `/choose-plan`.

---

### ✅ O que está OK (não vou tocar)
- `Register.tsx` — pre-check, signUp, mensagens i18n: sólido
- `create-checkout/index.ts` — success_url e auth fallback corretos
- `stripe-webhook/index.ts` — idempotência, role update, master/admin protection: sólidos
- Trigger `handle_new_user_simple` — captura unique_violation e loga em security_events
- Constraint UNIQUE em `profiles.phone_number`: aplicada
- `useCheckout.ts` — `window.location.href` (mesma aba): OK

### Plano de execução (4 mudanças cirúrgicas)

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `src/hooks/useAuth.ts` | Remover `signUp` obsoleto. Buscar usos com search e migrar se houver. |
| 2 | `src/pages/Welcome.tsx` | Adicionar botão "Conectar depois" + remover `disabled` do botão principal quando step!=='connected' (mantém o "Começar a usar" sempre clicável). |
| 3 | `src/pages/Index.tsx` | Trocar redirect cego por: `if (!whatsappSession && !sessionStorage.getItem('redirected_to_welcome'))`. Garante 1 redirect único. |
| 4 | `src/pages/AuthCallback.tsx` | Adicionar 1 retry de 3s na checagem de subscription antes de decidir destino. Se ambíguo, ir pra `/payment-success`. |

### Resultado garantido após as correções

- **Sem loops**: usuário nunca fica preso entre `/` e `/boas-vindas`
- **Sem código morto inseguro**: `useAuth.signUp` obsoleto removido
- **Sem cobrança dupla**: AuthCallback espera o webhook antes de oferecer `/choose-plan`
- **Sem "preso na tela WhatsApp"**: usuário pode pular e configurar depois pelo dashboard

