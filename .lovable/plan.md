

## Diagnóstico — `alexandre@aligator.com.br` não existe, mas o cadastro falha

### Fato confirmado pelo print do Supabase
Apenas 2 usuários existem:
- `adwords@aligator.com.br`
- `contato@aligator.com.br`

`alexandre@aligator.com.br` **não está cadastrado**. Mesmo assim, o frontend mostrou "Não foi possível completar a ação. Tente novamente." (toast vermelho genérico). Isso significa que o erro **não é duplicata** — é outra coisa, e o tratamento atual está mascarando a causa real.

### Investigação que vou fazer (read-only nesta fase)

1. Ler `src/pages/Register.tsx` — onde nasce o toast genérico, ver o que é capturado vs ignorado.
2. Ler `useAuth.ts signUp()` — confirmar todos os branches de erro tratados.
3. Ler logs recentes de `auth_logs` e `postgres_logs` no momento da tentativa do `alexandre@` para ver o erro real do Supabase.
4. Conferir trigger `handle_new_user_simple` (já visto no schema) — ele insere em `profiles` + cria `organizations` + `organization_members`. Se qualquer um falhar, o signup inteiro falha com erro 500 genérico.
5. Verificar se existe constraint UNIQUE em `profiles.phone_number` (o telefone `+55 11 91175 1247` foi usado antes em outro teste e pode estar travando).

### Causa raiz mais provável (hipótese forte)

O telefone `+5511911751247` provavelmente já está em `profiles.phone_number` de um teste anterior (mesmo que o e-mail seja novo), e:
- **Não há constraint UNIQUE** declarada no schema → o trigger não rejeita por isso.
- **Mas** o trigger `handle_new_user_simple` faz `ON CONFLICT (user_id) DO UPDATE` em `profiles` — que funciona.
- O que pode estar quebrando: criar nova `organizations` com nome duplicado, ou alguma RLS bloqueando algo.

Vou confirmar com a query de logs antes de prescrever a correção exata.

### Plano de correção (após investigação)

**A. Diagnóstico real exposto ao usuário**
Em `useAuth.ts signUp()`, capturar:
- `error.code` / `error.status` específicos do Supabase
- Mapear cada um para mensagem clara, traduzida nos 5 idiomas (pt-BR, pt-PT, en-US, es-ES, it-IT)
- Eliminar o catch-all "Não foi possível completar a ação"

**B. Pre-checagem antes do signUp (defesa em profundidade)**
Criar 2 RPCs SECURITY DEFINER:
- `check_email_available(p_email text) returns boolean` — checa em `auth.users`
- `check_phone_available(p_phone text) returns boolean` — checa em `profiles.phone_number` normalizado (E.164)

`Register.tsx` chama ambas antes de `signUp()`. Se qualquer uma falhar, mostra mensagem amigável **traduzida** e oferece ação:
- E-mail duplicado → "Esse e-mail já tem conta. [Fazer login] [Recuperar senha]"
- Telefone duplicado → "Esse WhatsApp já está vinculado a outra conta. Use outro número ou faça login."

**C. Constraint UNIQUE em telefone**
Migration adicionando:
```
CREATE UNIQUE INDEX profiles_phone_unique 
ON profiles (phone_number) 
WHERE phone_number IS NOT NULL;
```
Garantia dura no banco contra duplicatas, mesmo se o frontend falhar.

**D. Trigger blindado**
Ajustar `handle_new_user_simple` para:
- Capturar exceções de unique_violation (`SQLSTATE 23505`)
- Re-raise com mensagem clara que o frontend possa interpretar

**E. i18n completo dos erros**
Adicionar chaves em todos os 5 arquivos de locale:
- `auth.errors.email_already_exists`
- `auth.errors.phone_already_exists`
- `auth.errors.weak_password`
- `auth.errors.invalid_email`
- `auth.errors.network_error`
- `auth.errors.unknown_with_action` (com botão "Tentar novamente" e link de suporte)

Cada uma com tom amigável, sugerindo ação concreta — alinhado à filosofia `alert-design-philosophy` (sugestão, não erro agressivo).

### Promessa concreta

Após implementação:
1. **Antes do clique em "Continuar"**: pre-check valida e-mail + telefone, exibindo mensagem clara se já existir.
2. **No signUp()**: cada erro Supabase é mapeado a uma mensagem específica nos 5 idiomas.
3. **No banco**: constraint UNIQUE impede fisicamente duplicatas de telefone.
4. **Zero toast genérico**: o catch-all "Tente novamente" só aparece em erro de rede real (offline), com instrução clara.
5. **Trilha de auditoria**: cada falha de cadastro registra em `audit_logs` para você ver no admin o que aconteceu.

### O que NÃO vou tocar

- Stripe webhook, checkout, fluxo pós-pagamento (estável)
- WhatsApp agent
- Outras tabelas/RLS além de `profiles` (constraint) e novas RPCs

