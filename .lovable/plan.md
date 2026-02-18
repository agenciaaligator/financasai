
# Correcao Definitiva do Onboarding

## Causa Raiz Identificada

### Bug 1: Email de confirmacao vai para `/` (home)
**Arquivo**: `Register.tsx`, linha 43
**Problema**: A chamada `supabase.auth.signUp()` nao inclui `emailRedirectTo`. O Supabase usa o Site URL padrao (`/`) como destino apos confirmar email. O usuario cai na home em vez de `/auth/callback`.
**Correcao**: Adicionar `emailRedirectTo: \`\${window.location.origin}/auth/callback\`` nas options do signUp.

### Bug 2: Fallbacks do AuthCallback redirecionam para `/`
**Arquivo**: `AuthCallback.tsx`, linhas 18 e 24
**Problema**: Quando ha erro ou sessao nao encontrada, redireciona para `/` (home). Deveria ir para `/login`.
**Correcao**: Trocar `navigate('/')` por `navigate('/login')` nos dois pontos.

### Bug 3: Welcome.tsx filtra sessoes WhatsApp por expires_at
**Arquivo**: `Welcome.tsx`, linhas 49-52 e Index.tsx linhas 384-389
**Problema**: O banco de dados trata sessoes como permanentes (sem verificar expires_at), mas o frontend filtra por `.gt('expires_at', new Date().toISOString())`. Se a sessao expirou no timestamp mas e valida, o usuario e forçado a reconectar desnecessariamente.
**Correcao**: Remover o filtro `.gt('expires_at', ...)` em Welcome.tsx e Index.tsx para alinhar com a logica do banco.

---

## Alteracoes por Arquivo

### 1. Register.tsx (1 linha)
Adicionar `emailRedirectTo` na chamada signUp:
```typescript
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: normalizedEmail,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,  // ADICIONAR
    data: {
      full_name: name.trim(),
      phone_number: phone || undefined,
    },
  },
});
```

### 2. AuthCallback.tsx (2 linhas)
Trocar fallbacks de `/` para `/login`:
- Linha 18: `setTimeout(() => navigate('/login'), 3000);`
- Linha 24: `navigate('/login', { replace: true });`

### 3. Welcome.tsx (1 trecho)
Remover filtro `.gt('expires_at', ...)` na consulta de whatsapp_sessions (linha 51):
```typescript
// DE:
.gt('expires_at', new Date().toISOString())
// PARA:
// (remover essa linha - sessoes sao permanentes)
```

### 4. Index.tsx (1 trecho)
Mesma correcao no check de whatsapp_sessions (linha 388):
```typescript
// DE:
.gt('expires_at', new Date().toISOString())
// PARA:
// (remover essa linha)
```

### 5. Deploy da edge function create-checkout
Garantir que a funcao esta deployada com o codigo mais recente (success_url apontando para `/payment-success`).

---

## O que NAO muda
- PaymentSuccess.tsx - o codigo ja esta correto (verificado)
- Welcome.tsx - barra de progresso e logica de WhatsApp obrigatorio ja estao corretos
- LoginForm.tsx - banner de email confirmado ja esta implementado
- Locales - ja atualizados
- Stripe webhook, create-checkout (logica interna), banco de dados

## Resultado Esperado
- Email de confirmacao redireciona para `/auth/callback` -> `/boas-vindas`
- Pos-pagamento mostra tela de `/payment-success` com instrucoes claras
- Nenhum redirecionamento perdido para home (`/`)
- Sessoes WhatsApp permanentes reconhecidas corretamente
