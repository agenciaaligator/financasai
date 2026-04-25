# 🔧 Configurações Necessárias no Supabase Dashboard

> Documento atualizado para o domínio oficial **`https://donawilma.com.br`** + envio de e-mails via SMTP da Hostinger.

---

## 1. URL Configuration (Authentication → URL Configuration)

### Site URL (campo único, no topo)

```
https://donawilma.com.br
```

### Redirect URLs

```
https://donawilma.com.br/**
http://localhost:5173/**                  (opcional, ambiente local)
```

O wildcard `/**` cobre todas as rotas internas (`/reset-password`, `/set-password`, `/auth/callback`, `/boas-vindas`, `/payment-success`, etc.).

---

## 2. SMTP customizado (Authentication → Emails → SMTP Settings)

Para que e-mails de cadastro, recuperação de senha e magic link saiam de `contato@donawilma.com.br` em vez do remetente padrão do Supabase, ative o SMTP customizado e cole estes valores:

| Campo               | Valor                              |
|---------------------|------------------------------------|
| **Enable Custom SMTP** | ✅ Ligado                       |
| **Sender email**    | `contato@donawilma.com.br`         |
| **Sender name**     | `Dona Wilma`                       |
| **Host**            | `smtp.hostinger.com`               |
| **Port number**     | `465`                              |
| **Username**        | `contato@donawilma.com.br`         |
| **Password**        | (senha da caixa de e-mail Hostinger) |
| **Minimum interval** | `60` segundos (proteção rate-limit) |

> Se a Hostinger bloquear a porta 465 no seu plano, use `587` (STARTTLS).

Depois de salvar, clique em **Send test email** para validar (envie um teste para o seu próprio e-mail e confirme a chegada).

---

## 3. Templates de e-mail (Authentication → Emails → Templates)

Personalize os 4 templates abaixo no Supabase. Use links com o domínio oficial:

- **Confirm signup**: link `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup`
- **Reset password**: link `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`
- **Magic link**: link `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink`
- **Change email**: link `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change`

Como o Site URL acima é `https://donawilma.com.br`, todos os links saem corretos.

---

## 4. Edge Functions e secrets já configurados

Os seguintes secrets foram adicionados e estão disponíveis nas Edge Functions:

- `SMTP_HOST = smtp.hostinger.com`
- `SMTP_PORT = 465`
- `SMTP_USER = contato@donawilma.com.br`
- `SMTP_PASS = ••••••` (senha da caixa Hostinger)
- `SMTP_FROM_NAME = Dona Wilma`

A Edge Function **`send-app-email`** é o ponto único de envio de e-mails do app. Outras funções (como `submit-contact-message`) já chamam ela automaticamente para:
- Notificar `contato@donawilma.com.br` quando alguém envia o formulário de contato.
- Enviar confirmação de recebimento ao usuário que enviou a mensagem.

---

## 5. Domínio publicado (Hostinger) — Fallback SPA

> 🏠 **Hospedagem oficial: Hostinger.** O domínio `donawilma.com.br` é servido exclusivamente pela Hostinger. Não usar Lovable hosting nem Vercel para este domínio.

O app é uma SPA (React Router em modo `BrowserRouter`). Para que rotas como `/login` ou `/reset-password` abram quando digitadas direto na barra do navegador (ou clicadas em link de e-mail), o servidor precisa fazer **fallback para `index.html`** sempre que o caminho não for um arquivo real.

### ⚠️ Diagnóstico atual — dois problemas combinados

1. **Resíduo da Vercel**: `https://donawilma.com.br/reset-password` está retornando 404 da **Vercel**, o que prova que ainda existe um deploy/registro DNS antigo da Vercel respondendo pelo domínio. **Ação**: entrar no painel da Vercel → projeto antigo → **Settings → Domains** → remover `donawilma.com.br` e `www.donawilma.com.br`. Pausar/excluir o deploy se possível.
2. **Fallback SPA inativo na Hostinger**: `https://donawilma.com.br/login` retorna **HTTP 404 da Hostinger** ("This Page Does Not Exist"). O servidor não está redirecionando rotas inexistentes para `index.html`. Resolver com o `.htaccess` abaixo.

### Limpeza de DNS na Hostinger

Em **Hostinger → DNS Zone Editor**, garantir:
- Apenas registros `A`/`CNAME` apontando para o IP da Hostinger.
- **Apagar** qualquer registro antigo apontando para Vercel (`cname.vercel-dns.com`, `76.76.21.21`) ou outro provedor.

### Como resolver (escolha o que se aplica ao seu plano Hostinger)

- **Hospedagem estática / “Site Builder de arquivos”**: adicione um `.htaccess` na raiz do site com:
  ```apache
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
  ```
- **Hostinger Node.js / app Vite**: garanta no painel que o "fallback to index.html for SPA" está ligado.
- **Se nada disso resolver**: abra um chamado no suporte da Hostinger pedindo "rewrite all routes to /index.html for SPA app".

### Rotas para testar depois de aplicar o fallback

- `/`
- `/reset-password`
- `/set-password`
- `/auth/callback`
- `/boas-vindas`
- `/payment-success`
- `/payment-cancelled`
- `/subscription-inactive`
- `/login`
- `/choose-plan`
- `/register`
- `/termos`
- `/privacidade`
- `/admin`

Se alguma retornar 404, o fallback SPA não está ativo na Hostinger — abra um chamado no suporte deles pedindo "rewrite all routes to /index.html for SPA app".

---

## 6. Checklist final antes de liberar

- [ ] DNS propagado — `donawilma.com.br` aponta para a Hostinger (verifique em https://dnschecker.org)
- [ ] Site URL no Supabase = `https://donawilma.com.br`
- [ ] Redirect URLs incluem `https://donawilma.com.br/**`
- [ ] SMTP customizado ativo no Supabase com os valores do item 2
- [ ] Teste real de SMTP: clicar em "Send test email" no **Supabase → Authentication → Emails → SMTP Settings** e receber em `contato@donawilma.com.br` _(este teste só valida e-mails de autenticação; o formulário de contato do site é validado de outra forma — ver nota abaixo)_
- [ ] Templates de e-mail personalizados (item 3)
- [ ] Domínio oficial responde **sem 404** em todas as rotas listadas no item 5
- [ ] Teste real de signup → e-mail chega no inbox → link abre `/auth/callback` no domínio oficial → redireciona corretamente
- [ ] Teste real de reset de senha → e-mail chega → link abre `/reset-password` → trocar senha → login funciona
- [ ] Teste real do formulário de contato → você recebe a notificação em `contato@donawilma.com.br` E o usuário recebe a confirmação
- [ ] Teste real de pagamento Stripe → retorna em `https://donawilma.com.br/payment-success`

Quando todos estiverem ✅, o sistema está pronto para liberar.

> 💡 **Sobre o teste do formulário de contato**: não existe um botão de teste no Supabase para esse fluxo — ele é uma Edge Function customizada (`submit-contact-message` → `send-app-email`). A validação correta é submeter o formulário no site e confirmar que o e-mail chegou em `contato@donawilma.com.br` **e** a confirmação chegou no e-mail do remetente. Esse teste já foi realizado com sucesso ✅.

---

## Limites do SMTP Hostinger

- **~100 e-mails por hora** e **~3000/dia** (varia por plano).
- Para o MVP, é mais que suficiente. Se um dia o volume crescer, basta trocar os valores dos secrets `SMTP_*` para outro provedor (Resend, SendGrid) — nenhum código precisa mudar.
- SPF e DKIM já vêm configurados automaticamente pela Hostinger nos DNS.
