# Plano de ação — Validação final antes de liberar o sistema

## ✅ Infraestrutura resolvida (status atual)

| Item | Status |
|---|---|
| Hospedagem na Hostinger (`212.85.9.48`) | ✅ Ativa |
| DNS apontando corretamente (`@` A → `212.85.9.48`) | ✅ Propagado mundialmente |
| `.htaccess` com SPA fallback (React Router) | ✅ Configurado |
| Build atual (`dist/`) em `public_html/` | ✅ Publicado |
| Rotas internas (`/login`, `/reset-password`, etc.) | ✅ Abrindo sem 404 |
| SMTP customizado Hostinger no Supabase | ✅ Ativo |
| E-mail de reset de senha chegando de `contato@donawilma.com.br` | ✅ Validado |
| Link do e-mail abre `/reset-password` corretamente | ✅ Validado |

> Os DNS atuais estão funcionando e **não devem ser mexidos**. O CNAME `www` apontando para `donawilma.com.br` está OK porque o A `@` resolve para o IP correto.

---

## 📋 Checklist final de validação (testes manuais)

Faça cada teste em **aba anônima** (para garantir que não está usando sessão antiga em cache).

### A) Autenticação completa
- [ ] **Cadastro novo**: criar conta com e-mail real → receber e-mail de confirmação → clicar no link → cair em `/auth/callback` → ser redirecionado para o fluxo de boas-vindas
- [ ] **Login** com a conta criada → entrar no dashboard
- [ ] **Logout** → sessão encerrada, volta pra home
- [ ] **Esqueci minha senha** (a partir do `/login`) → receber e-mail → clicar no link → trocar senha em `/reset-password` → fazer login com a nova senha
- [ ] **E-mail duplicado**: tentar criar conta com e-mail já existente → mensagem de erro clara

### B) Onboarding e fluxo de pagamento
- [ ] **Escolha de plano** (`/choose-plan`) → selecionar plano mensal → ir pro Stripe Checkout em português (BRL)
- [ ] **Pagamento aprovado** → redireciona para `https://donawilma.com.br/payment-success`
- [ ] **Pagamento cancelado** → redireciona para `/payment-cancelled`
- [ ] **Tela de boas-vindas** (`/boas-vindas`) → exibida após pagamento
- [ ] **Conexão WhatsApp** → código numérico recebido no WhatsApp → validar → conexão ativa

### C) Dashboard e funcionalidades core
- [ ] **Hero card** com avatar da Dona Wilma carrega corretamente
- [ ] **Adicionar transação** (receita e despesa) manualmente
- [ ] **Editar transação** existente
- [ ] **Excluir transação** (com diálogo de confirmação digitando "DELETAR")
- [ ] **Filtros** por data, tipo, categoria funcionam
- [ ] **Categorias personalizadas**: criar, editar, excluir
- [ ] **Metas mensais**: criar meta, ver progresso, receber alerta
- [ ] **Relatórios avançados**: filtros, gráficos, exportação
- [ ] **Transações recorrentes**: criar, ver instâncias geradas

### D) WhatsApp Agent
- [ ] Enviar **mensagem de texto** com transação ("gastei 50 no mercado") → registrada com categoria correta
- [ ] Enviar **áudio** descrevendo gasto → transcrito e registrado
- [ ] Enviar **foto de comprovante** → OCR extrai valor e data
- [ ] Mencionar **recorrência** ("todo mês 100 de internet") → confirma e cria transação recorrente
- [ ] Consultar **saldo** → resposta correta
- [ ] Consultar **gastos do mês** → resposta correta

### E) Formulário de contato (landing page)
- [ ] Enviar mensagem pelo formulário → você recebe em `contato@donawilma.com.br` **e** o remetente recebe confirmação ✅ (já testado)

### F) Multi-idioma
- [ ] Trocar idioma na home (PT-BR, PT-PT, EN, ES, IT) → textos traduzidos
- [ ] Stripe Checkout abre no idioma selecionado
- [ ] Categorias traduzidas no dashboard conforme idioma

### G) Mobile (80% do tráfego esperado)
- [ ] Testar **todos os fluxos acima** em celular real (Android e iPhone se possível)
- [ ] Menu mobile (Sheet) abre e fecha sem travar
- [ ] Inputs numéricos abrem teclado numérico
- [ ] Modal de transação não corta na tela pequena
- [ ] Navegação por âncoras (#planos, #contato) funciona

### H) Painel Admin
- [ ] Acessar `/admin` com conta de admin
- [ ] Listar usuários, ver assinaturas ativas
- [ ] Ver mensagens recebidas pelo formulário de contato
- [ ] Estatísticas carregando

### I) Assinatura — ciclo completo
- [ ] Conta com `status = active` → acesso liberado
- [ ] Conta com `status = past_due` → banner de aviso (grace period)
- [ ] Conta com `status = canceled` → bloqueada em `/subscription-inactive`
- [ ] Botão "Gerenciar assinatura" → abre Stripe Customer Portal

### J) SEO e performance
- [ ] `https://donawilma.com.br/sitemap.xml` carrega
- [ ] `https://donawilma.com.br/robots.txt` carrega
- [ ] Página inicial tem `<title>` único (<60 chars) e `<meta description>` (<160 chars)
- [ ] Lighthouse mobile com nota razoável (>70 performance, >90 SEO)

### K) Segurança
- [ ] HTTPS funcionando com certificado válido em `donawilma.com.br` e `www.donawilma.com.br`
- [ ] Tentar acessar `/admin` sem ser admin → bloqueado
- [ ] Tentar acessar dados de outra organização via API → bloqueado pela RLS

---

## 🚀 Quando todos os ✅ estiverem marcados

O sistema está pronto para liberar para os primeiros usuários reais.

### Recomendações pós-lançamento
1. **Monitorar** as Edge Functions na Supabase nos primeiros dias (`stripe-webhook`, `whatsapp-webhook`, `send-app-email`)
2. **Verificar** semanalmente o limite de envios SMTP da Hostinger (~100/h, 3000/dia)
3. **Backup** automático do Supabase já está ativo (verificar retenção)
4. **Acompanhar** os primeiros pagamentos no Stripe Dashboard para confirmar webhook idempotente
5. Se o volume de e-mails crescer muito, trocar os secrets `SMTP_*` para Resend/SendGrid sem mexer em código

---

## Histórico (para referência)

- **Problema inicial**: 404 em `/login` e `/reset-password`
- **Causa raiz**: `.htaccess` no `public_html` continha apenas a regra `RewriteRule ^\.builds - [F,L]`, sem o bloco de SPA fallback do React Router
- **Solução aplicada**: substituído o `.htaccess` por:
  ```apache
  RewriteEngine On
  RewriteRule ^\.builds - [F,L]
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
  ```
- **Resultado**: todas as rotas internas passaram a abrir corretamente.
