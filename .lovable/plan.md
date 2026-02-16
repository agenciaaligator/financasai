
# Correcao: AuthEventHandler bloqueia renderizacao do ResetPassword

## Bug Identificado

O `AuthEventHandler` atual tem este fluxo:

```text
1. Tokens chegam em /reset-password#...&type=recovery
2. AuthEventHandler detecta type=recovery no hash -> isRecovery = true
3. Retorna <Navigate to="/reset-password#..."> 
4. Ja estamos em /reset-password -> React Router ignora (no-op)
5. Mas o componente CONTINUA retornando <Navigate> em vez de {children}
6. ResetPassword NUNCA monta!
7. Pagina fica em branco ou "cai" no redirect padrao
```

O `isRecovery` e um `useState` que nunca muda de valor. Entao o componente SEMPRE retorna `<Navigate>` e NUNCA renderiza os children (que incluem a rota `/reset-password`).

## Solucao

Adicionar verificacao do `location.pathname`: so redirecionar se NAO estivermos ja em `/reset-password`.

### Logica corrigida:

```text
if (isRecovery E pathname !== '/reset-password') -> <Navigate> (redireciona)
if (isRecovery E pathname === '/reset-password') -> renderiza children (ResetPassword monta)
if (!isRecovery) -> renderiza children normalmente
```

Isso cobre dois cenarios:
- Tokens chegam em `/` (home): redireciona para `/reset-password`, re-render com pathname correto, children renderizam
- Tokens chegam em `/reset-password` diretamente: children renderizam imediatamente

## Alteracao tecnica

### Arquivo: `src/App.tsx`

Adicionar `useLocation` e checar `location.pathname` no `AuthEventHandler`:

```typescript
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

const AuthEventHandler = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isRecovery] = useState(() => {
    const hash = window.location.hash;
    return hash.includes('type=recovery');
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          navigate('/reset-password', { replace: true });
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Redirecionar APENAS se nao estamos ja em /reset-password
  if (isRecovery && location.pathname !== '/reset-password') {
    const hash = window.location.hash;
    return <Navigate to={`/reset-password${hash}`} replace />;
  }

  return <>{children}</>;
};
```

### Por que funciona:

| Cenario | isRecovery | pathname | Resultado |
|---------|-----------|----------|-----------|
| Tokens chegam em `/` | true | `/` | Navigate para `/reset-password` |
| Apos Navigate (re-render) | true | `/reset-password` | Renderiza children |
| Tokens chegam em `/reset-password` | true | `/reset-password` | Renderiza children |
| PKCE (sem hash) | false | `/reset-password` | Renderiza children |
| Pagina normal | false | `/` | Renderiza children |

## Arquivo alterado

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar `useLocation` e condicao `pathname !== '/reset-password'` no AuthEventHandler |

## Resultado esperado

1. Usuario clica no link do email
2. Supabase redireciona para `/reset-password` com tokens
3. `AuthEventHandler` detecta recovery mas pathname ja e `/reset-password` -> renderiza children
4. `ResetPassword` monta, processa tokens via `getSession()` ou listener
5. Formulario de nova senha aparece corretamente

## Importante

Apos implementar, **publicar** a aplicacao e solicitar um **novo email** de recuperacao (links antigos ja foram consumidos).
