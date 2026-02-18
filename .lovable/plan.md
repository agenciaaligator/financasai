

# Correcao DEFINITIVA do Onboarding - 3 Bugs Confirmados

## Analise Completa

Investiguei todos os arquivos envolvidos no fluxo: `LoginForm.tsx`, `Welcome.tsx`, `Index.tsx`, `AuthCallback.tsx`, `Register.tsx`, `SignUpForm.tsx`, `useAuth.ts` e `App.tsx`.

---

## Bug 1 (CRITICO): Welcome.tsx causa loop infinito

**Arquivo**: `src/pages/Welcome.tsx`, linha 21 e 30-33

**O que acontece**:
- O `useAuth()` comeca com `user = null` e `loading = true` enquanto carrega a sessao
- O `useEffect` verifica `if (!user)` IMEDIATAMENTE, sem esperar o loading terminar
- Como `user` ainda e `null`, executa `navigate('/', { replace: true })`
- O Index.tsx carrega, detecta o usuario (que agora ja carregou), ve que nao tem WhatsApp, e redireciona de volta para `/boas-vindas`
- Welcome monta de novo, user ainda nao carregou, redireciona para `/` de novo
- LOOP INFINITO

**Correcao**:
```typescript
// Linha 21: extrair loading
const { user, loading } = useAuth();

// Linha 30-34: adicionar guard
useEffect(() => {
    if (loading) return; // ESPERAR auth resolver antes de decidir
    if (!user) {
      navigate('/', { replace: true });
      return;
    }
    // ... resto do codigo
}, [user, loading]);
```

---

## Bug 2 (CRITICO): LoginForm.tsx - navigate fica bloqueado se profile update falhar

**Arquivo**: `src/components/auth/LoginForm.tsx`, linhas 47-55

**O que acontece**:
- Apos `signIn` com sucesso, o codigo faz `await supabase.auth.getUser()` e `await profiles.update()`
- Se qualquer um desses `await` falhar (erro de rede, RLS, timeout), o codigo pula direto para o bloco `finally`
- O `navigate('/', { replace: true })` na linha 55 NUNCA executa
- O usuario ve o toast "Bem-vindo de volta!" mas fica preso na tela de login

**Correcao**: Mover o `navigate` para ANTES das operacoes de background:
```typescript
if (result && !result.error) {
    setPassword('');
    setErrorMessage(null);
    navigate('/', { replace: true }); // PRIMEIRO: navegar

    // DEPOIS: atualizar profile em background (nao bloqueia)
    supabase.auth.getUser().then(({ data: { user: loggedUser } }) => {
      if (loggedUser) {
        supabase.from('profiles')
          .update({ password_set: true })
          .eq('user_id', loggedUser.id);
      }
    });
}
```

---

## Bug 3: useAuth.ts tem emailRedirectTo apontando para raiz `/`

**Arquivo**: `src/hooks/useAuth.ts`, linhas 37-46

**O que acontece**:
- A funcao `signUp` do `useAuth` define `emailRedirectTo` como `https://donawilma.lovable.app/` (raiz)
- O `Register.tsx` NAO usa essa funcao (ele chama `supabase.auth.signUp` diretamente com a URL correta `/auth/callback`)
- Porem, se qualquer outro componente usar `useAuth().signUp` no futuro, o link do email vai apontar para a home

**Correcao**: Alinhar o `emailRedirectTo` para `/auth/callback`:
```typescript
const redirectUrl = `${window.location.origin}/auth/callback`;
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao | Linhas |
|---------|-----------|--------|
| `src/pages/Welcome.tsx` | Adicionar `loading` do useAuth e guard no useEffect | 21, 30-34, 62 |
| `src/components/auth/LoginForm.tsx` | Mover navigate para antes do profile update, converter update em background task | 47-55 |
| `src/hooks/useAuth.ts` | Corrigir emailRedirectTo para `/auth/callback` | 37-46 |

---

## Sobre o link do email

O template HTML esta correto (ambos os links usam `{{ .ConfirmationURL }}`). O `Register.tsx` ja envia `emailRedirectTo: /auth/callback` corretamente. As URLs de redirect estao configuradas no Supabase.

**Ponto importante**: Os links de emails enviados ANTES desta publicacao usam a URL antiga. Para testar o link do email corretamente, e necessario criar uma conta NOVA apos publicar esta versao.

---

## O que NAO muda

- Register.tsx (ja esta correto)
- AuthCallback.tsx (logica de redirecionamento correta)
- Index.tsx (corrigido na versao anterior)
- SignUpForm.tsx, edge functions, banco de dados, locales

## Resultado Esperado

1. Login: toast + navigate IMEDIATO para `/` (sem depender de profile update)
2. Index: verifica WhatsApp -> sem sessao -> redireciona para `/boas-vindas`
3. Welcome: ESPERA auth carregar -> exibe tela normalmente -> sem loop
4. Email (conta nova): link vai para `/auth/callback` -> redireciona para `/boas-vindas`
