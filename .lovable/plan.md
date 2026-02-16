

# Corrigir Fluxo de Recuperacao de Senha

## Problema Raiz

O componente `ResetPassword.tsx` usa `useSearchParams()` para buscar `access_token` e `refresh_token`. Porem, o Supabase envia esses tokens no **hash fragment** da URL (`#access_token=...`), nao nos query params (`?access_token=...`).

Resultado:
1. `searchParams.get('access_token')` retorna `null`
2. `getSession()` pode retornar `null` por race condition (o Supabase client ainda nao processou o hash)
3. O codigo cai no `else` (linha 71) e redireciona para `/` com toast "Acesso negado"

## Solucao

Reescrever o `useEffect` de inicializacao do `ResetPassword.tsx` para usar `onAuthStateChange` em vez de depender de query params. Essa abordagem:

- Escuta o evento `PASSWORD_RECOVERY` que o Supabase emite automaticamente ao processar os tokens do hash
- Elimina a race condition
- Funciona tanto com tokens no hash quanto no query param
- Tambem aceita sessao ja existente (como ja faz hoje para `/set-password`)

### Logica revisada:

```text
1. Verificar se ja existe sessao ativa → sessionEstablished = true
2. Se nao, registrar listener onAuthStateChange:
   - Evento PASSWORD_RECOVERY → sessionEstablished = true
   - Evento SIGNED_IN → sessionEstablished = true
3. Timeout de seguranca (5s): se nenhum evento chegar, mostrar erro e redirecionar
4. Tambem tentar parsear hash fragment manualmente como fallback
```

## Alteracao tecnica

### Arquivo: `src/pages/ResetPassword.tsx`

Substituir o `useEffect` atual (linhas 30-94) por:

```typescript
useEffect(() => {
  let timeout: NodeJS.Timeout;
  let resolved = false;

  const resolve = () => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    setSessionEstablished(true);
    setIsInitializing(false);
  };

  const reject = () => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    toast({
      title: "Link invalido ou expirado",
      description: "Solicite um novo link de recuperacao.",
      variant: "destructive",
    });
    setIsInitializing(false);
    navigate('/');
  };

  const init = async () => {
    // 1. Verificar sessao existente (para /set-password)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      resolve();
      return;
    }

    // 2. Tentar parsear hash fragment manualmente
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          resolve();
          return;
        }
      }
    }

    // 3. Escutar onAuthStateChange como fallback
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          if (session) resolve();
        }
      }
    );

    // 4. Timeout de seguranca
    timeout = setTimeout(() => {
      subscription.unsubscribe();
      reject();
    }, 8000);
  };

  init();

  return () => clearTimeout(timeout);
}, [navigate, toast]);
```

### Ponto importante

Para `/set-password`, o fluxo continua funcionando: o usuario ja possui sessao ativa, entao o passo 1 resolve imediatamente.

## Arquivo alterado

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/ResetPassword.tsx` | Reescrever logica de inicializacao para parsear hash fragment e escutar `onAuthStateChange` |

## Resultado esperado

1. Usuario clica "Esqueci minha senha" → recebe email
2. Clica no link do email → redirecionado para `/reset-password#access_token=...`
3. Componente parseia hash, estabelece sessao, mostra formulario de nova senha
4. Usuario define nova senha → redirecionado para `/boas-vindas`
