
# Correcao Definitiva: Fluxo de Recuperacao de Senha

## Causa Raiz REAL

O bug NAO esta no `AuthEventHandler` nem no `ResetPassword`. Esta no **sistema de versioning** em `main.tsx`.

### Sequencia do bug:

```text
1. Usuario clica no link do email
2. Supabase /verify valida token, redireciona para /reset-password#access_token=...&type=recovery
3. App carrega em /reset-password
4. main.tsx importa todos os modulos (Supabase client inicializa, limpa hash da URL)
5. main.tsx executa: busca versao remota
6. Versao mudou (porque voce acabou de publicar!) 
7. clearAllAndReload() executa:
   - localStorage.clear() -> destroi qualquer sessao do Supabase
   - sessionStorage.clear() -> destroi qualquer flag
   - window.location.replace('/?v=...') -> REDIRECIONA PARA HOME
8. App recarrega em /  (sem tokens, sem sessao)
9. Usuario ve a home page
```

Alem disso, o Supabase client (com `detectSessionInUrl: true`) limpa o hash da URL SINCRONAMENTE quando o modulo e importado, ANTES de qualquer codigo React rodar. Isso impede o `AuthEventHandler` de ver `type=recovery` no hash.

## Solucao (3 arquivos)

### 1. `index.html` - Capturar hash ANTES de tudo

Adicionar um `<script>` inline (nao module) ANTES do script principal. Esse script roda antes de qualquer import, antes do Supabase client inicializar:

```javascript
// Captura sincrona do hash de recovery ANTES do Supabase limpar
if (window.location.hash && window.location.hash.includes('type=recovery')) {
  sessionStorage.setItem('supabase_recovery', 'true');
  sessionStorage.setItem('supabase_recovery_hash', window.location.hash);
  sessionStorage.setItem('supabase_recovery_path', window.location.pathname);
}
```

### 2. `src/main.tsx` - Preservar contexto de recovery no clearAllAndReload

Na funcao `clearAllAndReload`, antes de limpar storages, salvar e restaurar os flags de recovery. E redirecionar para o pathname original em vez de sempre `/`:

```typescript
async function clearAllAndReload(newVersion: string) {
  // Preservar flags de recovery ANTES de limpar
  const recoveryFlag = sessionStorage.getItem('supabase_recovery');
  const recoveryHash = sessionStorage.getItem('supabase_recovery_hash');
  const recoveryPath = sessionStorage.getItem('supabase_recovery_path');

  // Limpar tudo
  localStorage.clear();
  sessionStorage.clear();
  // ... (limpar caches, service workers)

  // Restaurar flags de recovery
  if (recoveryFlag) {
    sessionStorage.setItem('supabase_recovery', recoveryFlag);
    sessionStorage.setItem('supabase_recovery_hash', recoveryHash || '');
    sessionStorage.setItem('supabase_recovery_path', recoveryPath || '/reset-password');
  }

  // Salvar nova versao
  localStorage.setItem('app_version', newVersion);

  // Redirecionar para o PATH ORIGINAL, nao para /
  const targetPath = recoveryPath || window.location.pathname;
  window.location.replace(targetPath + '?v=' + newVersion);
}
```

### 3. `src/App.tsx` - AuthEventHandler le de sessionStorage

```typescript
const AuthEventHandler = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isRecovery] = useState(() => {
    // Ler do sessionStorage (capturado no index.html antes do Supabase limpar)
    return sessionStorage.getItem('supabase_recovery') === 'true';
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isRecovery && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  return <>{children}</>;
};
```

### 4. `src/pages/ResetPassword.tsx` - Ler hash do sessionStorage

No useEffect, mudar a captura do hash:

```typescript
// ANTES:
const savedHash = window.location.hash;

// DEPOIS:
const savedHash = sessionStorage.getItem('supabase_recovery_hash') || window.location.hash;
```

E apos sucesso no reset, limpar os flags:

```typescript
// Apos updatePassword com sucesso:
sessionStorage.removeItem('supabase_recovery');
sessionStorage.removeItem('supabase_recovery_hash');
sessionStorage.removeItem('supabase_recovery_path');
```

## Por que isso funciona

| Etapa | O que acontece |
|-------|---------------|
| Link do email clicado | Browser navega para `/reset-password#access_token=...&type=recovery` |
| Script inline (index.html) | Captura hash e salva em sessionStorage ANTES de qualquer JS module |
| Supabase client inicializa | Limpa hash da URL (mas sessionStorage ja tem os dados) |
| main.tsx version check | Se versao mudou: preserva flags de recovery, redireciona para `/reset-password?v=...` (nao para `/`) |
| App renderiza | AuthEventHandler le sessionStorage: `isRecovery = true`, pathname = `/reset-password` → renderiza children |
| ResetPassword monta | Le hash de sessionStorage, faz `setSession()` com tokens, mostra formulario |
| Senha redefinida | Limpa flags de sessionStorage |

## Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `index.html` | Adicionar `<script>` inline para capturar hash de recovery antes dos modules |
| `src/main.tsx` | Preservar flags de recovery no `clearAllAndReload` e redirecionar para path original |
| `src/App.tsx` | `AuthEventHandler` le `supabase_recovery` de sessionStorage |
| `src/pages/ResetPassword.tsx` | Ler hash de sessionStorage; limpar flags apos sucesso |

## Nenhuma acao manual necessaria

Esta correcao e 100% em codigo. Nao precisa mudar nada no Supabase Dashboard.
