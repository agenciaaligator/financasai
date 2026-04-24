## Bug: Dashboard travado atrás do overlay do modal de login

### Causa raiz

Não existe rota `/dashboard` no `App.tsx`. A rota `/` renderiza `Index.tsx`, que faz roteamento condicional:
- Se `!user` → `<LandingPage />` (que contém o modal de login)
- Se `user` → `<ProtectedDashboard />` (renderiza `<FinancialDashboard />`)

Quando o usuário clica em "Login" na landing, o `LandingPage` abre o modal (`showLogin = true`) — um overlay full-screen `fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm` (Index.tsx linhas 118–141).

No submit do `LoginForm` (linha 50), ele chama `navigate('/', { replace: true })`. Como já estávamos em `/`, o React Router **não desmonta** `Index` — apenas re-renderiza. O `useAuth` detecta a sessão nova, `user` passa a existir, e `Index` decide renderizar `<ProtectedDashboard />` no lugar de `<LandingPage />`.

**Mas** o `LandingPage` foi desmontado, e com ele o modal de login... só que a screenshot mostra claramente o overlay escuro cobrindo o dashboard. Isso acontece porque, no fluxo normal:

1. `LoginForm` chama `signIn` → sucesso
2. `navigate('/')` (mesma URL — no-op)
3. O `Index` re-renderiza, mas durante a checagem `checkUserStatus` (linha 507) ele entra no estado `checkingFirstLogin = true` e mostra um loader. Para usuários **com** WhatsApp já vinculado, o loader some e renderiza o dashboard. Para usuários **sem** WhatsApp, redireciona para `/boas-vindas`.

O problema visual da screenshot é diferente: o usuário fez login, foi para o dashboard, **mas o overlay continua visível**. Isso indica que o `LandingPage` continua montado em paralelo OU que ficou um portal/dialog órfão (provavelmente do `ForgotPasswordModal` ou do próprio modal de login).

Olhando de novo: o modal de login do `Index.tsx` é **renderizado dentro do componente `LandingPage`** que só monta quando `!user`. Quando `user` aparece, `LandingPage` desmonta e o modal vai junto. **Então o overlay visível na screenshot tem outra fonte.**

Suspeitos reais:
1. **`ForgotPasswordModal`** — usa Radix Dialog (portal), e se o estado ficar travado em `open=true` quando o componente pai desmonta, o overlay pode ficar órfão. Mas pela imagem o usuário não estava no fluxo de "esqueci senha".
2. **A `LoginForm` usa `navigate('/')` sem fechar o modal antes.** O re-render é síncrono mas o `setState` interno do React Router pode causar uma janela onde `LandingPage` ainda existe com `showLogin=true` enquanto o `useAuth` propaga o novo user. Em um único frame isso seria invisível, mas há um efeito de transição com `animate-fadeInUp` no modal.
3. **Mais provável:** o overlay que aparece na imagem é o `bg-foreground/40 backdrop-blur-sm` do modal de login que ficou renderizado porque o **Sidebar/dashboard renderiza dentro do mesmo Index, e o `showLogin` permaneceu `true` após o login** — não, isso não cola, pois `LandingPage` desmontou.

Vou investigar uma hipótese mais simples na implementação: **o overlay na imagem pode ser o do `Sheet` (menu mobile)** que ficou aberto. O `Sheet` do Radix renderiza um overlay `fixed inset-0 bg-black/80` em portal. Se `sheetOpen` ficou `true` quando `LandingPage` desmontou, o portal pode ficar pendurado momentaneamente. Mas como ele é desmontado junto com o pai, deveria sumir.

### Correção pragmática

Independente da causa exata (precisaria ver replay), as correções abaixo eliminam todas as fontes possíveis do overlay órfão:

#### 1. `LoginForm.tsx` — emitir callback de sucesso

Adicionar prop opcional `onSuccess?: () => void` e chamá-la **antes** de navegar. No submit:

```tsx
if (result && !result.error) {
  setPassword('');
  setErrorMessage(null);
  onSuccess?.();           // fecha modal pai imediatamente
  navigate('/', { replace: true });
  // ...
}
```

#### 2. `Index.tsx` (LandingPage) — fechar modal no sucesso

Passar callback ao `LoginForm`:

```tsx
<LoginForm onSuccess={() => setShowLogin(false)} />
```

E também: garantir que o modal feche se `user` mudar (defesa em profundidade):

```tsx
useEffect(() => {
  if (user) {
    setShowLogin(false);
    setSheetOpen(false);
  }
}, [user]);
```

(`user` viria de `useAuth` no `LandingPage`, que hoje não consome — adicionar.)

#### 3. Substituir o modal manual por `Dialog` do shadcn

O modal atual é uma `<div fixed inset-0>` artesanal. Trocar por `<Dialog>` do shadcn garante:
- Cleanup automático do overlay ao desmontar.
- Acessibilidade (focus trap, ESC, aria correto).
- Sem risco de overlay órfão.

```tsx
<Dialog open={showLogin} onOpenChange={setShowLogin}>
  <DialogContent className="max-w-md p-0 bg-transparent border-0 shadow-none">
    <LoginForm onSuccess={() => setShowLogin(false)} />
  </DialogContent>
</Dialog>
```

#### 4. Defesa extra: resetar `sheetOpen` ao logar

Mesmo tratamento para o `Sheet` mobile, no mesmo `useEffect` acima.

### Arquivos a editar

- `src/components/auth/LoginForm.tsx` — adicionar prop `onSuccess` e chamar antes do `navigate`.
- `src/pages/Index.tsx`:
  - Trocar overlay manual por `<Dialog>` do shadcn (`@/components/ui/dialog`).
  - Adicionar `useAuth` no `LandingPage` e `useEffect` que fecha `showLogin` e `sheetOpen` quando `user` aparece.

### Validação após o fix

1. Logar pelo desktop → modal fecha imediatamente, dashboard renderiza limpo, navegação no sidebar funciona.
2. Logar pelo mobile (via Sheet) → menu lateral fecha, modal fecha, dashboard limpo.
3. Tecla ESC fecha modal corretamente (ganho do `Dialog`).
4. Sem regressão em "Esqueci minha senha".

### Critério de sucesso

- Não há overlay escuro residual após login.
- Sidebar e botões do dashboard são clicáveis imediatamente após login.
- `Dialog` substitui o modal artesanal sem quebrar layout do `LoginForm`.

**Confirma para eu aplicar?**
