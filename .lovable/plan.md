## Diagnóstico — por que o link de reset abriu na home

Ao clicar no link do email, você foi para `https://donawilma.com.br/reset-password#access_token=...&type=recovery`. O esperado era ver o formulário de nova senha. Em vez disso, abriu a home.

**Causa raiz:** o sistema de "version check" em `src/main.tsx` detectou nova versão do app, fez `clearAllAndReload(...)` e redirecionou via `window.location.replace(targetPath + '?v=' + newVersion)`. O problema é que `window.location.replace` **descarta o `#hash`** da URL — exatamente onde o Supabase coloca o `access_token` e o `type=recovery`.

Existe uma tentativa de preservar isso salvando `supabase_recovery_hash` no sessionStorage **antes** de limpar (linhas 76-78), e restaurando depois (86-89). Mas há duas falhas:

1. O `sessionStorage.clear()` na linha 83 acontece **antes** da captura do hash em `index.html` (linhas 60-71) ter chance de rodar de novo após o reload — porque o reload vai para `?v=...` **sem o hash**, então o snippet de captura no `index.html` não acha mais `type=recovery` e não re-salva nada. A primeira captura **sim** funciona (na primeira carga, antes do reload). Mas depois disso o hash é descartado da URL.
2. O fluxo então cai em `/reset-password?v=...` **sem hash e sem flag de recovery válida** → `ResetPassword.tsx` não consegue estabelecer sessão → após 10s do timeout, faz `navigate('/')`. Como sua percepção foi "abriu a home", provavelmente caiu nesse timeout (ou no fallback).

Confirmação adicional: a URL que você está vendo agora é `/?v=1777043923973` — exatamente o padrão do `clearAllAndReload`.

---

## Correção (1 arquivo)

**`src/main.tsx`** — preservar o hash no redirect:

```ts
// linha ~110
const targetPath = recoveryPath || window.location.pathname || '/';
const hashToPreserve = recoveryHash || window.location.hash || '';
window.location.replace(targetPath + '?v=' + newVersion + hashToPreserve);
```

E também: **se for um fluxo de recovery, pular o version-check e renderizar direto**, evitando o reload destrutivo logo no clique do email:

```ts
// no início do bloco "else" (linha 124), antes do version check:
const isRecoveryFlow = 
  sessionStorage.getItem('supabase_recovery') === 'true' || 
  window.location.hash.includes('type=recovery');

if (isRecoveryFlow) {
  console.log('[MAIN] Fluxo de recovery detectado - pulando version check');
  createRoot(document.getElementById("root")!).render(<App />);
} else {
  // ... lógica de version check existente
}
```

Isso resolve a raiz: durante recuperação de senha, **nada** de cache-busting acontece. O hash chega intacto em `ResetPassword.tsx` e o formulário aparece.

---

## Revisão de todas as URLs e rotas

### Redirect URLs do Supabase (sua screenshot) — ✅ OK

Você já adicionou as 4 do `donawilma.com.br`:
- `https://donawilma.com.br/**` (wildcard cobre tudo)
- `/reset-password`, `/set-password`, `/payment-success`

**Sugestão (opcional):** as URLs específicas (`reset-password`, `set-password`, `payment-success`, `boas-vindas`, `auth/callback`) já estão **cobertas pelo wildcard** `https://donawilma.com.br/**`. Pode deletar as específicas para limpar a lista — funciona igual. As do `donawilma.lovable.app` pode manter como fallback ou remover (você não usa mais).

### Rotas no app — ✅ OK

Todas as rotas declaradas em `App.tsx` são consistentes com o que é usado em `redirectTo` / `emailRedirectTo`:

| Origem | Destino | Status |
|---|---|---|
| `useAuth.resetPassword()` | `${origin}/reset-password` | ✅ |
| `SignUpForm` | `${origin}/?pending_checkout=...` | ✅ |
| `Register.tsx` | `${origin}/auth/callback` | ✅ |
| `Index.tsx` (set-password) | `/set-password` | ✅ |
| `create-checkout` (origin fallback) | `https://donawilma.lovable.app` | ⚠️ ver abaixo |

### Pequena pendência — `create-checkout` fallback

`supabase/functions/create-checkout/index.ts:81`:
```ts
const origin = req.headers.get("origin") || "https://donawilma.lovable.app";
```

Em produção o header `Origin` chega corretamente como `https://donawilma.com.br`, então o fallback **nunca é usado** na prática. Mas por consistência, atualizar o fallback para `https://donawilma.com.br`.

### `index.html`, `robots.txt`, `sitemap.xml`, Stripe Portal, locales — ✅ OK

Tudo já apontando para `donawilma.com.br`.

---

## Sobre o email do remetente (sua observação)

Você disse: "preciso melhorar isso, talvez um gmail para o cliente não estranhar e achar suspeito".

**Não use Gmail.** Email pessoal como remetente em sistema de produção fica muito mais suspeito (cai em spam, sem DKIM/SPF, sem domínio próprio). O caminho profissional é usar o **próprio domínio** que você já tem: `noreply@donawilma.com.br` ou `contato@donawilma.com.br`.

Você tem **duas opções** para fazer isso (NÃO vou implementar agora, só apresento):

**Opção A — Lovable Cloud Emails (mais simples, gerenciado):**
Como o projeto está em Supabase externo, esse caminho não se aplica diretamente.

**Opção B — Resend via domínio próprio (você já tem `RESEND_API_KEY` configurado nos secrets):**
1. Adicionar o domínio `donawilma.com.br` no Resend Dashboard
2. Adicionar registros DNS (SPF, DKIM, DMARC) no provedor do `donawilma.com.br`
3. Verificar o domínio
4. Criar uma edge function `auth-email-hook` que substitui os emails padrão do Supabase, enviando via Resend com remetente `Dona Wilma <noreply@donawilma.com.br>`, com template em português, branding e logo
5. Configurar o webhook no Supabase Dashboard → Authentication → Email Templates → "Send email hook"

Resultado: emails de confirmação/recuperação chegam de `Dona Wilma <noreply@donawilma.com.br>` com template branded em português, sem cara de "default Supabase".

Existe também o documento `CONFIGURACAO_SUPABASE.md` na raiz do projeto que menciona uma edge function `custom-auth-emails` — vou verificar se já existe algo nessa linha quando formos implementar.

---

## O que será alterado nesta etapa (apenas correção)

1. **`src/main.tsx`** — pular version check em fluxo de recovery + preservar hash no `window.location.replace`
2. **`supabase/functions/create-checkout/index.ts`** — fallback de `origin` para `donawilma.com.br`

Nada que está funcionando será alterado. As correções são cirúrgicas.

---

## Próximos passos (suas decisões)

Depois que eu aplicar as correções acima:

1. **Testar reset de senha novamente** — agora deve abrir o formulário direito
2. **Decidir sobre o email do remetente:**
   - (a) deixar como está por enquanto (emails padrão do Supabase)
   - (b) implementar agora o template branded via Resend com `noreply@donawilma.com.br`
3. **Limpar (opcional)** as redirect URLs específicas do Supabase, mantendo só o wildcard

Aprovando, eu já aplico as 2 correções e te aviso para testar o link de reset.
