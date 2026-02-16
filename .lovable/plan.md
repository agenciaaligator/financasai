

# Substituir "FinançasAI / financasai" por "Dona Wilma / donawilma" + Criar Pagina de Login

## Problema
Varias mensagens do sistema ainda usam o nome antigo "FinançasAI" e o dominio "financasai.lovable.app", causando confusao para os usuarios. Alem disso, apos confirmar o email, o usuario e enviado para a home sem uma pagina dedicada de login.

## 1. Substituicoes de marca (7 arquivos)

### supabase/functions/whatsapp-webhook/index.ts (linhas 911-917)
- "FinançasAI" -> "Dona Wilma"
- "financasai.lovable.app" -> "donawilma.lovable.app"

### supabase/functions/whatsapp-agent/index.ts (multiplos locais)
- Linha 6995: "Assistente Financeiro" -> "Dona Wilma"
- Linha 6998: "financasai.lovable.app" -> "donawilma.lovable.app"
- Linha 7030: "financasai.lovable.app/boas-vindas" -> "donawilma.lovable.app/boas-vindas"
- Linha 7069: "FinançasAI" -> "Dona Wilma"
- Linha 7119: "financasai.lovable.app" -> "donawilma.lovable.app"

### src/components/admin/AdminPanel.tsx
- Linha 15: "Finanças AI" -> "Dona Wilma"
- Linha 27: "Finanças AI" -> "Dona Wilma"

### index.html (SEO/metatags)
- Linha 10: canonical URL -> donawilma.lovable.app
- Linhas 15, 20, 26: og:url, og:image, twitter:image -> donawilma.lovable.app
- Linha 35: JSON-LD url -> donawilma.lovable.app

### public/sitemap.xml
- Todas as URLs: financasai -> donawilma

### public/robots.txt
- Sitemap URL: financasai -> donawilma

### CONFIGURACAO_SUPABASE.md
- Linha 65: financasai -> donawilma

## 2. Criar pagina de Login dedicada (/login)

Atualmente, o login e um modal na landing page. Para melhorar a experiencia quando o usuario clica no link de confirmacao de email, criaremos uma rota `/login` que mostra o formulario de login diretamente.

### Novo arquivo: src/pages/Login.tsx
- Pagina simples com o componente `LoginForm` centralizado
- Logo "Dona Wilma" no topo
- Link "Criar conta" para /choose-plan

### Alteracao em src/App.tsx
- Adicionar rota: `<Route path="/login" element={<Login />} />`

### Alteracao em src/pages/AuthCallback.tsx
- Quando usuario confirma email e nao tem assinatura: redirecionar para `/choose-plan`
- Quando tem assinatura: redirecionar para `/login` (para que faca login e entre no dashboard)

## Resumo de arquivos

| Arquivo | Tipo de alteracao |
|---------|------------------|
| supabase/functions/whatsapp-webhook/index.ts | Substituicao de marca |
| supabase/functions/whatsapp-agent/index.ts | Substituicao de marca (5 locais) |
| src/components/admin/AdminPanel.tsx | Substituicao de marca |
| index.html | Substituicao de URLs |
| public/sitemap.xml | Substituicao de URLs |
| public/robots.txt | Substituicao de URL |
| CONFIGURACAO_SUPABASE.md | Substituicao de URL |
| src/pages/Login.tsx | **Novo arquivo** - pagina de login dedicada |
| src/App.tsx | Adicionar rota /login |

