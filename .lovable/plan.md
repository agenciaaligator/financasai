
# Corrigir Fluxo de Recuperacao de Senha - Solucao Definitiva

## Diagnostico Final

O `AuthEventHandler` atual usa `useEffect` para detectar tokens de recovery. Porem, `useEffect` roda APOS o primeiro render. Isso causa uma corrida:

```text
1. Tokens de recovery chegam na URL (/ ou /reset-password)
2. Supabase client processa os tokens automaticamente (detectSessionInUrl: true)
3. React renderiza: AuthEventHandler renderiza children -> Index renderiza
4. Index detecta usuario logado -> redireciona para /boas-vindas ou dashboard
5. SO DEPOIS disso o useEffect do AuthEventHandler dispara
6. Tarde demais - o usuario ja foi redirecionado para outra pagina
```

A solucao e fazer a deteccao de recovery **durante o render** (sincrono), nao no useEffect.

## Solucao

Modificar o `AuthEventHandler` em `src/App.tsx` para:

1. **Checar hash no RENDER** (sincrono): se `window.location.hash` contem `type=recovery`, retornar `<Navigate to="/reset-password" />` em vez de renderizar os children. Isso IMPEDE que Index monte.

2. **Manter useEffect** para PKCE: o listener `onAuthStateChange` continua capturando `PASSWORD_RECOVERY` para o caso de PKCE (onde nao ha hash, apenas `?code=`).

3. **Adicionar estado `isRecovery`**: usar useState inicializado com a deteccao sincrona do hash, para controlar se deve renderizar Navigate ou children.

### Codigo revisado do AuthEventHandler:

```typescript
const AuthEventHandler = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  
  // Deteccao SINCRONA durante render - antes de qualquer child montar
  const [isRecovery, setIsRecovery] = useState(() => {
    const hash = window.location.hash;
    return hash.includes('type=recovery');
  });

  useEffect(() => {
    // Para PKCE flow (tokens em ?code=, sem hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password', { replace: true });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Se recovery detectado no hash, redirecionar ANTES de renderizar children
  if (isRecovery) {
    const hash = window.location.hash;
    return <Navigate to={`/reset-password${hash}`} replace />;
  }

  return <>{children}</>;
};
```

### Por que isso funciona:

- O `useState` com inicializador sincrono roda ANTES do primeiro render
- Se `type=recovery` esta no hash, o componente retorna `<Navigate>` em vez de `{children}`
- `Index` NUNCA monta, entao nao pode fazer redirects concorrentes
- O componente `ResetPassword` monta com os tokens disponiveis no hash
- Para PKCE (sem hash), o `onAuthStateChange` no useEffect captura `PASSWORD_RECOVERY`

## Arquivo alterado

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Reescrever `AuthEventHandler` para deteccao sincrona de recovery no render, usando Navigate em vez de useEffect navigate |

## Resultado esperado

1. Link do email redireciona para `https://donawilma.lovable.app/#access_token=...&type=recovery` (ou `/reset-password#...`)
2. `AuthEventHandler` detecta `type=recovery` no hash DURANTE o render
3. Retorna `<Navigate to="/reset-password#...">` imediatamente
4. `ResetPassword` monta, processa os tokens, mostra formulario
5. Usuario define nova senha com sucesso

## Observacao importante

Apos a implementacao, sera necessario **publicar** a aplicacao antes de testar no dominio `donawilma.lovable.app`. Se testar sem publicar, o dominio publicado estara rodando o codigo antigo.
