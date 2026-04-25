## Decisão: hospedagem fica na Hostinger

A hospedagem oficial de `donawilma.com.br` é a **Hostinger**. Não vamos migrar para Lovable nem para Vercel.

## Problema
- `/login` retorna 404 da Hostinger
- `/reset-password` retorna 404 da Vercel

Causas:
1. Ainda existe um deploy/registro DNS da Vercel ativo para o domínio.
2. O fallback SPA (`index.html`) não está ativo na Hostinger.

O código React está correto — as mesmas rotas funcionam no preview `donawilma.lovable.app`.

## O que o usuário faz nos painéis

### 1. Vercel — remover o domínio
- Settings → Domains → remover `donawilma.com.br` e `www.donawilma.com.br`.
- Pausar/excluir o deploy antigo se possível.

### 2. Hostinger — DNS Zone Editor
- Manter apenas registros `A`/`CNAME` apontando para o IP da Hostinger.
- Apagar qualquer registro antigo apontando para Vercel (`cname.vercel-dns.com`, `76.76.21.21`, etc.).

### 3. Hostinger — `.htaccess` na pasta `public_html/`
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### 4. Hostinger — confirmar build atualizado
- Conteúdo de `dist/` deve estar em `public_html/` (com `index.html` e pasta `assets/`).

### 5. Validar URLs digitando direto no navegador
`/`, `/login`, `/reset-password`, `/auth/callback`, `/payment-success`, `/admin`.

Se ainda der 404 da Hostinger após o `.htaccess`, abrir chamado pedindo:
*"ativar rewrite de todas as rotas para /index.html (SPA fallback)"*.

## O que o Lovable já fez
- Atualizou `CONFIGURACAO_SUPABASE.md` deixando Hostinger como único caminho oficial.
- Atualizou este plano.

## Resultado esperado
`donawilma.com.br` servido somente pela Hostinger, com todas as rotas internas funcionando ao serem digitadas direto na barra ou abertas via link de e-mail do Supabase.
