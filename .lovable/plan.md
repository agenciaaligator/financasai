# Próximos passos após ativar SMTP no Supabase

SMTP customizado ativo no Supabase é o último bloqueio técnico para os e-mails de autenticação. Agora o trabalho é: (1) validar que tudo realmente funciona em produção, (2) limpar resquícios da Vercel, (3) garantir que não sobraram pontos onde o sistema poderia voltar a usar o domínio errado.

Não posso "garantir matematicamente zero bugs" — isso só vem dos testes reais com e-mail e cartão de verdade. Mas posso eliminar todos os riscos conhecidos e te entregar um checklist objetivo. É isso que esta etapa faz.

---

## O que vou alterar no código

### 1. Remover `vercel.json` (resquício da hospedagem antiga)
Você migrou para a Hostinger, mas o arquivo `vercel.json` ainda está no repositório. Não causa erro hoje, mas:
- Confunde quem ler o projeto depois.
- Se um dia alguém reconectar a Vercel por engano, ela vai aplicar configurações antigas.

Ação: deletar `vercel.json`.

### 2. Corrigir o canonical do `/admin`
No `src/components/admin/AdminPanel.tsx` (linha 41) ainda existe:
```ts
canonical.setAttribute("href", `${window.location.origin}/admin`);
```
Em produção isso fica certo, mas se alguém abrir o admin por um domínio de preview o canonical aponta pro domínio errado (ruim pra SEO e indexa páginas que não deveriam).

Ação: trocar por `buildSiteUrl('/admin')` usando o helper `src/lib/siteUrl.ts` que já existe.

### 3. Confirmar `submit-contact-message`
Já está chamando `send-app-email` corretamente para os dois lados (admin + usuário). Vou apenas reler o fluxo após deploy e checar logs no primeiro envio real.

Nenhuma outra mudança de código é necessária — todas as outras URLs de saída (`create-checkout`, `customer-portal`, signup, reset de senha, links no WhatsApp) já usam `donawilma.com.br` via `getSiteUrl()` ou constantes fixas.

---

## Checklist de testes que você precisa fazer (depois do deploy)

Sem esses testes não é possível afirmar "está sem bugs". Cada item leva ~1 min:

**A. SMTP / e-mails de autenticação**
1. No Supabase → **Authentication → Emails → SMTP Settings**, clicar em **Send test email** e enviar pra você mesmo. Tem que chegar de `contato@donawilma.com.br`.
2. Criar uma conta nova de teste em `https://donawilma.com.br/register` → e-mail de confirmação chega → link abre `/auth/callback` no domínio oficial → cai em `/payment-success` ou `/boas-vindas`.
3. Pedir reset de senha em `https://donawilma.com.br/login` → e-mail chega → link leva pra `/reset-password` → consegue trocar a senha → consegue logar com a nova.

**B. Formulário de contato**
4. Enviar uma mensagem pelo formulário. Esperado: você recebe a notificação em `contato@donawilma.com.br` (com botão "Responder" indo pro usuário) E o usuário recebe a confirmação automática.

**C. Pagamento**
5. Clicar em "Assinar" → checkout Stripe abre → após pagar (use cartão real ou modo de teste) → volta para `https://donawilma.com.br/payment-success`.
6. Logado, abrir o portal do cliente Stripe → também volta para `donawilma.com.br`.

**D. Rotas SPA da Hostinger**
7. Abrir direto no navegador (não via menu): `https://donawilma.com.br/reset-password`, `/auth/callback`, `/admin`, `/termos`. Se alguma der 404 → abrir chamado na Hostinger pedindo "rewrite all routes to /index.html for SPA".

**E. WhatsApp (smoke test)**
8. Mandar um áudio/texto pro número conectado e confirmar que a transação aparece no dashboard. (Os links que o agente envia já usam `donawilma.com.br`.)

---

## Detalhes técnicos (resumo)

- **Arquivos editados nesta etapa**: `src/components/AdminPanel.tsx` (1 linha), `vercel.json` (deletado).
- **Sem migrations**, sem novas Edge Functions, sem novos secrets.
- **Logs pra acompanhar no primeiro teste real**:
  - `send-app-email`: confirma se o SMTP autenticou.
  - `submit-contact-message`: confirma os 2 disparos.
  - `auth` (Supabase Logs): confirma que o template de signup/recovery foi enviado pelo SMTP custom.

---

## O que continua sendo responsabilidade sua (não automatizável)

- Conferir no painel da **Hostinger** que o build mais recente está publicado.
- Aguardar 100% da propagação DNS (`https://dnschecker.org` em verde para `donawilma.com.br` e `www`).
- No **Supabase → Auth → URL Configuration**, confirmar:
  - Site URL = `https://donawilma.com.br`
  - Redirect URLs incluem `https://donawilma.com.br/**`

Aprovando este plano, eu faço as 2 alterações de código, e em seguida você roda o checklist de 8 testes acima. Qualquer item que falhar, me manda o print/log e eu corrijo direto.
