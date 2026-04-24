# 🔧 Configurações Necessárias no Supabase Dashboard

> Documento atualizado para o domínio oficial **`https://donawilma.com.br`**.

---

## 1. URL Configuration (Authentication → URL Configuration)

### Site URL (campo único, no topo)

```
https://donawilma.com.br
```

> Use **um único** Site URL — o domínio canônico oficial. Não coloque `donawilma.lovable.app` aqui.

### Redirect URLs

```
https://donawilma.com.br/**
https://donawilma.lovable.app/**          (opcional, contingência durante migração)
http://localhost:5173/**                  (opcional, ambiente local)
```

O wildcard `/**` cobre todas as rotas internas (`/reset-password`, `/set-password`, `/auth/callback`, `/boas-vindas`, `/payment-success`, etc.).

---

## 2. Domínio publicado (CRÍTICO antes de liberar o sistema)

O domínio oficial precisa servir o app Lovable (SPA), com **fallback para `index.html`** em qualquer rota interna.

Teste no navegador (ou `curl -I`) cada uma destas rotas no domínio oficial. Todas devem **carregar a tela do app** (não 404):

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

Se qualquer uma retornar `404 NOT_FOUND`, o problema é de publicação/DNS, **não de código**. Nesse caso o link de recuperação de senha sempre vai cair na home, mesmo que o app esteja correto.

---

## 3. E-mails de autenticação

Atualmente os e-mails de signup e recovery são enviados pelo próprio Supabase (`noreply@mail.app.supabase.io`).

Se quiser personalizar (recomendado, para não parecer spam):

1. Configurar domínio próprio (ex.: `mail.donawilma.com.br`) em Resend (já temos `RESEND_API_KEY`).
2. Ativar template customizado via `auth-email-hook` para enviar pelo seu domínio.

> Isso é **opcional** para liberar o sistema — os e-mails padrão do Supabase já funcionam e levam para o link correto, desde que as URLs acima estejam configuradas.

---

## 4. Checklist final antes de liberar

- [ ] Site URL = `https://donawilma.com.br`
- [ ] Redirect URLs incluem `https://donawilma.com.br/**`
- [ ] Domínio oficial responde **sem 404** em todas as rotas listadas no item 2
- [ ] Teste real: solicitar reset de senha → e-mail chega → link abre `/reset-password` no domínio oficial → tela de redefinição aparece → trocar senha → login funciona
- [ ] Teste real: criar conta → e-mail de confirmação chega → link abre `/auth/callback` no domínio oficial → redireciona corretamente
- [ ] Teste real: pagamento Stripe → retorna em `https://donawilma.com.br/payment-success`
- [ ] Customer Portal Stripe configurado com return URL `https://donawilma.com.br`

Quando todos estiverem ✅, o sistema está pronto para liberar.
