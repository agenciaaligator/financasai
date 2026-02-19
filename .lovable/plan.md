

# Correcao Completa do Onboarding - 5 Problemas Criticos

## Analise dos Problemas

### Problema 4 (Critico): Redirecionamento para /set-password
**Causa raiz**: O `useSubscriptionGuard` (linha 47) verifica `password_set` no perfil. O trigger `handle_new_user_simple()` cria o perfil com `password_set = false` (valor default da coluna). O `Register.tsx` tenta atualizar para `true` na linha 102, mas essa operacao pode falhar porque:
1. O usuario acabou de ser criado e pode nao ter sessao autenticada ativa ainda
2. A operacao roda ANTES do checkout Stripe e pode ser perdida

Alem disso, o `AuthCallback.tsx` (linha 35) tambem checa `password_set` e redireciona para `/set-password`, criando um loop.

**Correcao**:
- `Register.tsx`: Ja define a senha no signup, entao `password_set` deve ser `true`. Mover o update para DEPOIS da confirmacao de sessao, ou melhor: setar via `user_metadata` no proprio `signUp()` e no trigger
- `AuthCallback.tsx`: Remover o check de `password_set` - quem criou conta via `/register` ja definiu senha. O guard do dashboard ja cuida disso
- `useSubscriptionGuard.ts`: Considerar `password_set = true` para usuarios que criaram conta via signup com senha (checar se `user_metadata.full_name` existe como indicador)

### Problema 1: Email enviado antes do pagamento
**Causa raiz**: `supabase.auth.signUp()` envia email de confirmacao automaticamente. Isso e comportamento padrao do Supabase e NAO pode ser desabilitado via codigo frontend.

**Correcao pragmatica**: Isso NAO e um bug - e o fluxo intencional. O email de confirmacao e necessario para validar o email. O fluxo correto e:
1. Signup -> email enviado
2. Checkout Stripe -> pagamento
3. Usuario confirma email (a qualquer momento)
4. AuthCallback -> boas-vindas

O timing do email nao e um problema real - o usuario pode confirmar antes ou depois do pagamento.

### Problema 2: Pos-checkout vai para home
**Causa raiz**: O `create-checkout` (linha 95) ja configura `success_url` para `/payment-success`. O `PaymentSuccess.tsx` ja redireciona para `/boas-vindas` quando o usuario esta logado com assinatura ativa. Se o usuario NAO esta logado (caso mais comum - sessao expirou durante checkout), mostra "Verifique seu email". Isso esta correto.

**Verificacao**: Nenhuma mudanca necessaria no checkout. O fluxo ja funciona.

### Problema 3: WhatsApp mostra erro mas funciona
**Ja corrigido** na ultima edicao - removemos o `upsert` redundante. A verificacao do `Welcome.tsx` agora esta correta.

### Problema 5: Falta tela de boas-vindas no dashboard
**Correcao**: Adicionar deteccao de primeiro acesso no dashboard com banner de boas-vindas.

---

## Plano de Implementacao

### 1. Register.tsx - Garantir password_set = true no signup

Passar `password_set: true` nos metadados do usuario no `signUp()`:

```typescript
data: {
  full_name: name.trim(),
  phone_number: phone || undefined,
  password_set: true,  // NOVO
},
```

Mover o update do perfil para DEPOIS do signUp, usando o service role via trigger. Alterar o trigger `handle_new_user_simple()` para definir `password_set = true` quando `raw_user_meta_data->>'password_set'` for `'true'`.

### 2. Migration SQL - Trigger handle_new_user_simple

Atualizar o trigger para ler `password_set` dos metadados do usuario:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_simple()
...
  -- Extrair password_set dos metadados
  user_password_set := COALESCE((new.raw_user_meta_data->>'password_set')::boolean, false);
  
  INSERT INTO public.profiles (user_id, full_name, email, phone_number, password_set)
  VALUES (new.id, user_name, new.email, user_phone, user_password_set)
  ...
```

### 3. AuthCallback.tsx - Remover redirect para /set-password

O `AuthCallback.tsx` nao deve mais redirecionar para `/set-password`. Usuarios que vem da confirmacao de email ja definiram senha no registro. Simplificar o fluxo:
- Se tem sessao + assinatura ativa -> `/boas-vindas`
- Se tem sessao + sem assinatura -> `/choose-plan`
- Se nao tem sessao -> `/login`

### 4. useSubscriptionGuard.ts - Relaxar check de password_set

Para usuarios que fizeram signup com senha (nao via convite), `password_set` deve ser considerado `true`. Adicionar fallback: se o usuario tem `user_metadata.password_set === true`, aceitar mesmo que o perfil diga `false` (race condition do trigger).

Isso ja esta parcialmente implementado na linha 47-48:
```typescript
const passwordSet = profile?.password_set === true || 
  user.user_metadata?.password_set === true;
```

Isso deve funcionar desde que passemos `password_set: true` no `signUp()`.

### 5. Welcome.tsx - Botao "Comecar agora"

O botao `handleGoToDashboard` (linha 195) ja navega para `/`. Verificar que `sessionStorage.setItem('onboarding_completed', 'true')` esta sendo setado corretamente para evitar o loop de redirect para `/boas-vindas`.

### 6. Dashboard - Banner de primeiro acesso

Adicionar no `DashboardContent.tsx` uma verificacao de primeiro acesso:
- Checar `sessionStorage.getItem('onboarding_completed')` ou `localStorage.getItem('first_dashboard_seen')`
- Se for primeiro acesso, mostrar banner com dicas de uso do WhatsApp
- Marcar como visto em `localStorage`

---

## Resumo dos arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Register.tsx` | Adicionar `password_set: true` nos metadados do signUp |
| `src/pages/AuthCallback.tsx` | Remover redirect para /set-password. Simplificar fluxo |
| Migration SQL | Atualizar trigger para ler password_set dos metadados |
| `src/components/dashboard/DashboardContent.tsx` | Adicionar banner de primeiro acesso |

## Resultado esperado

1. Signup -> senha definida -> password_set = true no perfil (via trigger)
2. Checkout Stripe -> /payment-success
3. Email confirmado -> /auth/callback -> /boas-vindas (SEM /set-password)
4. WhatsApp conectado -> "Comecar agora" -> dashboard COM banner de boas-vindas
5. Login posterior -> dashboard direto (sem /set-password, sem /boas-vindas se WhatsApp ja conectado)

