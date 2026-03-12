
## Correcao Final - Fluxo de Onboarding

### Bug Critico Encontrado

**Problema 5: Validacao do codigo WhatsApp SEMPRE falha** (mesmo com codigo correto)

A edge function `validate-code` retorna `{ valid: true, message: "Codigo valido" }`, mas o frontend (`Welcome.tsx` linha 163) verifica `data?.success`. Como `success` nao existe na resposta, o frontend interpreta como erro e mostra "Codigo invalido ou expirado" mesmo quando o codigo esta correto.

Isso explica tambem o Problema 4 (parece que o codigo nao funciona) e o Problema 6 (mensagem de boas-vindas nunca chega, pois o usuario nunca conclui a validacao com sucesso no frontend).

### Alteracoes Necessarias

#### 1. Corrigir Welcome.tsx - Verificacao da resposta validate-code

**Arquivo:** `src/pages/Welcome.tsx` (linha 163)

Alterar de:
```tsx
if (!data?.success) throw new Error(data?.error || 'Codigo invalido ou expirado');
```

Para:
```tsx
if (!data?.valid && !data?.success) throw new Error(data?.message || data?.error || 'Codigo invalido ou expirado');
```

Isso aceita tanto `{ valid: true }` (resposta atual) quanto `{ success: true }` (se for alterado no futuro).

#### 2. Limpeza de dados do usuario de teste

Executar queries SQL para limpar os dados de `alexandre@aligator.com.br`:
```sql
DELETE FROM whatsapp_sessions WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'alexandre@aligator.com.br'
);
DELETE FROM whatsapp_validation_codes WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'alexandre@aligator.com.br'
);
DELETE FROM user_roles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'alexandre@aligator.com.br'
);
DELETE FROM user_subscriptions WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'alexandre@aligator.com.br'
);
DELETE FROM organization_members WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'alexandre@aligator.com.br'
);
DELETE FROM organizations WHERE owner_id IN (
  SELECT id FROM auth.users WHERE email = 'alexandre@aligator.com.br'
);
DELETE FROM profiles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'alexandre@aligator.com.br'
);
```

A exclusao do usuario de `auth.users` precisa ser feita via Supabase Dashboard (Authentication > Users) ou pela edge function `delete-user-admin`.

### Problemas 2 e 3: Email Timing e Link

**Nao ha bug de codigo aqui.** O fluxo atual e:
1. `signUp()` envia email de confirmacao (comportamento nativo Supabase)
2. Usuario faz checkout no Stripe
3. Stripe webhook ativa a assinatura
4. Usuario confirma email quando quiser
5. Link do email vai para `/auth/callback` (ja configurado corretamente na linha 47 do Register.tsx)
6. `/auth/callback` verifica assinatura e redireciona para `/boas-vindas`

O email e enviado no momento do signup porque o Supabase nao permite adiar o envio. Isso NAO e um bug - o usuario pode confirmar o email a qualquer momento, antes ou depois do checkout.

### Resumo

A unica alteracao de codigo necessaria e a correcao da verificacao da resposta em `Welcome.tsx`. O resto sao operacoes de limpeza de dados no banco.
