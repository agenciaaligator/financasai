

# Corrigir Fluxo de Recuperacao de Senha - Causa Raiz Real

## Diagnostico

O problema nao esta no `ResetPassword.tsx`. O componente **nunca e renderizado** porque o redirecionamento do Supabase cai na pagina `/` (Index).

### Fluxo atual (com bug):

```text
1. Usuario clica no link do email
2. Supabase /verify processa o token (status 303)
3. Supabase redireciona para Site URL padrao: https://donawilma.lovable.app/#access_token=...&type=recovery
   (porque /reset-password nao esta na lista de Redirect URLs permitidas)
4. Index.tsx carrega, detecta usuario logado, mostra dashboard
5. Formulario de nova senha NUNCA aparece
```

### Fluxo correto (apos correcao):

```text
1. Usuario clica no link do email
2. Supabase /verify processa o token (status 303)
3. Redireciona para / com tokens no hash
4. App.tsx detecta evento PASSWORD_RECOVERY globalmente
5. Redireciona automaticamente para /reset-password
6. Formulario de nova senha aparece corretamente
```

## Solucao (duas acoes)

### Acao 1: Configuracao no Supabase Dashboard (manual)

Adicionar `https://donawilma.lovable.app/reset-password` na lista de Redirect URLs do Supabase:
- Acessar Authentication > URL Configuration > Redirect URLs
- Adicionar: `https://donawilma.lovable.app/reset-password`
- Adicionar tambem: `https://id-preview--bc45aac3-c622-434f-ad58-afc37c18c6c2.lovable.app/reset-password`

### Acao 2: Listener global no App.tsx (codigo - defesa em profundidade)

Mesmo que a configuracao do Supabase seja corrigida, adicionar um listener global no `App.tsx` que detecta o evento `PASSWORD_RECOVERY` e redireciona para `/reset-password`. Isso funciona como **fallback** caso os tokens cheguem na pagina errada.

#### Alteracao em `src/App.tsx`:

Criar um componente wrapper `AuthEventHandler` dentro do `BrowserRouter` que:

```text
1. Registra onAuthStateChange globalmente
2. Se evento === 'PASSWORD_RECOVERY' -> navigate('/reset-password')
3. Executa antes de qualquer rota ser processada
```

Codigo do componente:

```typescript
const AuthEventHandler = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar hash fragment ao carregar
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Tokens de recovery chegaram na pagina errada, redirecionar
      navigate('/reset-password' + hash, { replace: true });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password', { replace: true });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  return children;
};
```

Envolver as `<Routes>` com esse componente no `App.tsx`.

### Ajuste no `ResetPassword.tsx`

Nenhuma alteracao necessaria - o componente ja esta correto com a logica de captura de hash e listener. Ele so precisa ser **alcancado** pelo router, que e o que essa correcao garante.

## Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar `AuthEventHandler` que detecta `PASSWORD_RECOVERY` e redireciona para `/reset-password` |

## Acao manual do usuario

Adicionar as URLs de redirect no painel do Supabase em Authentication > URL Configuration > Redirect URLs:
- `https://donawilma.lovable.app/reset-password`
- `https://id-preview--bc45aac3-c622-434f-ad58-afc37c18c6c2.lovable.app/reset-password`

## Resultado esperado

Mesmo que o Supabase redirecione para `/` com tokens de recovery, o `AuthEventHandler` detecta e redireciona automaticamente para `/reset-password`, onde o formulario aparece corretamente.

