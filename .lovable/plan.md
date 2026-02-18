
# Correcao Definitiva do Onboarding - 3 Bugs Identificados

## Bugs Encontrados

### Bug 1: LoginForm nao navega apos login bem-sucedido
**Arquivo**: `src/components/auth/LoginForm.tsx`
**Problema**: Apos `signIn()` retornar sucesso (linha 47), o componente apenas limpa a senha e nao faz nada. O usuario fica preso na tela `/login` com o toast "Login realizado! Bem-vindo de volta!" mas sem redirecionamento.
**Correcao**: Adicionar `navigate('/', { replace: true })` apos login bem-sucedido. O Index.tsx ja tem a logica de verificar WhatsApp e redirecionar para `/boas-vindas`.

### Bug 2: Index.tsx bloqueado por sessionStorage de tentativas anteriores
**Arquivo**: `src/pages/Index.tsx`, linhas 361-368
**Problema**: Quando o usuario tenta acessar o sistema multiplas vezes, as flags `onboarding_completed` e `redirected_to_welcome` ficam salvas no sessionStorage. Na proxima vez que o Index carrega, ele ve essas flags e pula a verificacao do WhatsApp, mandando direto para o dashboard.
**Correcao**: Remover a verificacao de `redirected_to_welcome` como bloqueador. A unica flag que deve impedir o redirect e `onboarding_completed` (que e setada quando o usuario realmente completou o onboarding no Welcome.tsx). A flag `redirected_to_welcome` deve ser usada apenas como protecao contra loop infinito dentro da mesma execucao (usando o `hasCheckedRef` que ja existe).

### Bug 3: Email de confirmacao redireciona para home
**Problema**: O codigo do `Register.tsx` ja tem `emailRedirectTo` correto apontando para `/auth/callback`, MAS a URL `https://donawilma.lovable.app/auth/callback` precisa estar na lista de **Redirect URLs** permitidas no Supabase Dashboard (Authentication > URL Configuration). Se nao estiver, o Supabase ignora o parametro e usa o Site URL padrao (que e a raiz `/`).
**Correcao no codigo**: Nenhuma (ja esta correto). **Correcao manual necessaria**: Adicionar `https://donawilma.lovable.app/auth/callback` na lista de Redirect URLs no Supabase Dashboard.

---

## Alteracoes por Arquivo

### 1. LoginForm.tsx - Adicionar navegacao pos-login

Apos login bem-sucedido (dentro do `if (result && !result.error)`), adicionar:
```typescript
navigate('/', { replace: true });
```
Isso envia o usuario para Index.tsx, que verifica se tem WhatsApp conectado e redireciona para `/boas-vindas` se nao tiver.

### 2. Index.tsx - Corrigir logica de sessionStorage

Alterar a verificacao nas linhas 361-368:
- Manter `onboarding_completed` como unico bloqueador real
- Remover `redirected_to_welcome` como bloqueador (essa flag impedia o redirect em tentativas subsequentes)
- O `hasCheckedRef` ja protege contra loop infinito na mesma renderizacao

Codigo corrigido:
```typescript
const onboardingCompleted = sessionStorage.getItem('onboarding_completed') === 'true';

if (onboardingCompleted) {
  hasCheckedRef.current = true;
  setCheckingFirstLogin(false);
  return;
}
```

### 3. Acao Manual no Supabase Dashboard (OBRIGATORIA)

Acessar Authentication > URL Configuration e adicionar estas URLs na lista de Redirect URLs:
- `https://donawilma.lovable.app/auth/callback`
- `https://id-preview--bc45aac3-c622-434f-ad58-afc37c18c6c2.lovable.app/auth/callback`

Sem isso, o Supabase ignora o `emailRedirectTo` e o link do email sempre vai para a home.

---

## O que NAO muda

- Register.tsx - emailRedirectTo ja esta correto
- AuthCallback.tsx - logica de redirecionamento para /boas-vindas ja esta correta
- Welcome.tsx - barra de progresso e WhatsApp obrigatorio ja estao corretos
- PaymentSuccess.tsx - tela de confirmacao ja esta correta (conforme screenshot)
- Edge functions, banco de dados, locales

## Resultado Esperado

1. Apos login: usuario vai para `/` -> Index verifica WhatsApp -> sem sessao -> redireciona para `/boas-vindas`
2. Apos confirmacao de email: link vai para `/auth/callback` -> detecta assinatura -> redireciona para `/boas-vindas`
3. Sem bloqueio por flags de sessoes anteriores
