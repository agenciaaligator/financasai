

# Auditoria Completa - Dona Wilma (Micro SaaS)

## Status Atual

O sistema tem uma base funcional robusta: landing page, dashboard financeiro, WhatsApp bot com IA, Google Calendar, sistema de equipe/organizacoes, Stripe checkout, e admin panel. Porem, existem varios pontos que precisam ser resolvidos antes da comercializacao.

---

## 1. CRITICO: Problemas que Impedem a Publicacao

### 1.1 Pricing em modo TESTE
O arquivo `src/config/pricing.ts` esta com `MODE = 'test'`, mostrando precos de R$1,00/mes e R$10,00/ano na landing page e checkout. Antes de publicar, trocar para `'production'` (R$24,90/mes e R$239,04/ano).

### 1.2 Diagnostico de Visibilidade exposto ao usuario
No dashboard (DashboardContent.tsx, linhas 377-425), existe um card "Diagnostico de Visibilidade" que exibe informacoes tecnicas (organization_id, permissoes, contagem de transacoes com/sem org_id). Isso e para debug e **nao deve aparecer para usuarios finais**.

### 1.3 Console.logs excessivos em producao
Varios componentes tem `console.log` de debug espalhados:
- `AppSidebar.tsx` - log completo de debug a cada render
- `FinancialDashboard.tsx` - 7+ console.logs por render
- `DashboardContent.tsx` - logs de diagnostico
- `useSubscription.ts` - logs de plano

Esses logs devem ser removidos ou condicionados a ambiente de desenvolvimento.

### 1.4 Cron Jobs desativados
Todos os 3 cron jobs foram removidos (lembretes, agenda diaria, sync Google Calendar). Antes de publicar, recriar com frequencias adequadas:
- `send-daily-agenda`: 1x ao dia as 8h (`0 8 * * *`)
- `send-commitment-reminders`: 1x por hora (`0 * * * *`)
- `check-expired-trials`: 1x ao dia as 2h (`0 2 * * *`)

### 1.5 Sidebar mostra "FinancasAI" em vez de "Dona Wilma"
No `AppSidebar.tsx`, o header da sidebar mostra "FinancasAI - Gestao Inteligente" tanto no mobile quanto no desktop. Deveria ser "Dona Wilma".

---

## 2. IMPORTANTE: Melhorias de Usabilidade

### 2.1 Landing Page
- **Copyright desatualizado**: Footer mostra "2024" em vez de "2025/2026"
- **Estatisticas falsas**: `StatsSection.tsx` mostra "+150.2K registros", "+163.7 Milhoes em valor", "87.3K compromissos", "99.9% precisao". Para um produto novo, isso pode gerar desconfianca. Substituir por beneficios ou remover.
- **Depoimentos falsos**: `TestimonialsSection.tsx` tem depoimentos ficticios com nomes e fotos placeholder. Remover ate ter depoimentos reais, ou substituir por secao "Como funciona".
- **Dominio mencionado incorretamente**: StatsSection menciona "donawilma.com" mas o dominio publicado e "financasai.lovable.app"

### 2.2 Plano Gratuito nao esta visivel
Na landing page e na pagina de planos, so aparece o plano Premium. Nao ha opcao visivel de "plano gratuito" ou "comecar gratis". O FAQ menciona "plano Gratuito sem limite de tempo" mas nao ha como acessar. Se existe um tier gratuito com 50 transacoes e 10 categorias (conforme `featureFlags.ts`), deveria ter um card de plano gratuito na landing page.

### 2.3 Fluxo de Onboarding
- Na pagina de Welcome (`/boas-vindas`), o texto diz "Sua conta Premium esta ativa" mesmo que o usuario nao tenha pago. Deveria ser dinamico baseado no plano real.
- Nao ha botao de "Criar conta gratuita" visivel - so "Entrar" e "Ver planos"

### 2.4 Termos de servico e politica de privacidade
Na pagina de checkout diz "Ao continuar, voce concorda com nossos termos de servico" mas nao ha link para termos reais. Obrigatorio para SaaS.

### 2.5 Pagina de perfil muito longa
O `ProfileSettings.tsx` tem 1103 linhas com muitas funcionalidades misturadas (perfil, senha, WhatsApp, Google Calendar, plano, debug de lembretes). Para uma senhora de 80 anos, isso seria muito confuso. Considerar separar em abas ou secoes colapsaveis.

---

## 3. RECOMENDADO: Evolucoes para Comercializacao

### 3.1 Pagina de termos e privacidade
Criar paginas `/termos` e `/privacidade` com conteudo legal basico. Obrigatorio para pagamentos.

### 3.2 SEO e Meta Tags
O `index.html` provavelmente precisa de meta tags (title, description, og:image) adequadas para compartilhamento e SEO.

### 3.3 Plano gratuito como porta de entrada
Adicionar card de plano gratuito na landing page com botao "Comecar gratis" que leva ao cadastro. Isso funciona como funil: Free -> Trial -> Premium.

### 3.4 Email de boas-vindas e recuperacao
Verificar se os emails de confirmacao e reset de senha estao personalizados (nao usar templates padrao do Supabase).

### 3.5 Dark Mode
O sistema usa `next-themes` mas nao parece ter toggle visivel de dark mode para o usuario.

### 3.6 PWA / Mobile App Feel
Considerar adicionar manifest.json e service worker para que usuarios mobile possam "instalar" o app na tela inicial.

---

## 4. Detalhes Tecnicos

### Arquivos que precisam de alteracao:

| Arquivo | Alteracao |
|---------|-----------|
| `src/config/pricing.ts` | Trocar MODE de 'test' para 'production' |
| `src/components/AppSidebar.tsx` | Trocar "FinancasAI" por "Dona Wilma", remover console.logs |
| `src/components/dashboard/DashboardContent.tsx` | Remover card de diagnostico, remover console.logs |
| `src/components/FinancialDashboard.tsx` | Remover console.logs excessivos |
| `src/components/StatsSection.tsx` | Substituir numeros falsos ou remover |
| `src/components/TestimonialsSection.tsx` | Remover depoimentos falsos ou substituir |
| `src/pages/Index.tsx` | Atualizar copyright para 2025 |
| `src/pages/Welcome.tsx` | Texto dinamico baseado no plano real |
| `src/pages/ChoosePlan.tsx` | Adicionar link para termos |
| `src/hooks/useSubscription.ts` | Remover console.logs |

### Cron Jobs para recriar (via SQL Editor):

```text
send-daily-agenda:           0 8 * * *    (1x dia as 8h)
send-commitment-reminders:   0 * * * *    (1x por hora)
check-expired-trials:        0 2 * * *    (1x dia as 2h)
```

---

## Prioridade de Implementacao

1. Trocar pricing para producao
2. Remover card de diagnostico e console.logs
3. Corrigir nome "FinancasAI" para "Dona Wilma"
4. Atualizar copyright e remover stats/depoimentos falsos
5. Recriar cron jobs com frequencias corretas
6. Adicionar paginas de termos/privacidade
7. Melhorar visibilidade do plano gratuito

