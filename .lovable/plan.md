## Plano de correção completa de URLs

Vou corrigir o problema pela raiz, centralizando o domínio canônico e removendo qualquer dependência de `window.location.origin`, `origin` do request ou hosts antigos que possam mandar o usuário para a home errada.

### O que será corrigido

1. Centralizar a URL oficial do sistema
- Criar uma origem canônica única para produção (`https://donawilma.com.br`).
- Fazer o app usar essa URL nos fluxos críticos de autenticação e retorno.
- Manter fallback seguro para ambiente local/preview sem contaminar links reais enviados ao cliente.

2. Corrigir links de e-mail do Supabase
- Ajustar o reset de senha para não depender mais do host atual do navegador.
- Ajustar o link de confirmação/callback de cadastro para não depender do domínio onde o usuário abriu o app.
- Revisar também fluxos alternativos de cadastro já existentes no projeto para evitar regressão.

3. Corrigir retornos do Stripe
- Ajustar `create-checkout` para usar URLs de sucesso/cancelamento consistentes e corretas.
- Ajustar `customer-portal` para voltar para a rota correta no domínio oficial, sem cair indevidamente na home por host errado.

4. Corrigir links antigos e inconsistentes fora do fluxo principal
- Remover links ainda apontando para `lovableproject.com`.
- Remover fallback derivado automaticamente para `.vercel.app` em mensagens do WhatsApp.
- Revisar mensagens e links auxiliares para usar apenas o domínio correto.

5. Fazer uma auditoria final de rotas e URLs críticas
- Validar estas rotas no código e no deploy: `/reset-password`, `/set-password`, `/auth/callback`, `/payment-success`, `/payment-cancelled`, `/subscription-inactive`, `/boas-vindas`, `/choose-plan`.
- Confirmar que nenhum fluxo legítimo depende de redirecionamento para `/` quando deveria ir para uma rota específica.

### Problemas encontrados na revisão

- `src/hooks/useAuth.ts`: o reset de senha usa `window.location.origin/reset-password`.
- `src/pages/Register.tsx`: a confirmação de cadastro usa `window.location.origin/auth/callback`.
- `src/components/auth/SignUpForm.tsx`: existe um fluxo alternativo antigo que ainda monta redirect para a home com query string.
- `supabase/functions/create-checkout/index.ts`: `success_url` e `cancel_url` dependem do header `origin`.
- `supabase/functions/customer-portal/index.ts`: `return_url` depende do header `origin`.
- `supabase/functions/whatsapp-agent/index.ts`: ainda existem links apontando para `bc45aac3-c622-434f-ad58-afc37c18c6c2.lovableproject.com` e fallback para `.vercel.app`.

### Arquivos que pretendo ajustar

- `src/hooks/useAuth.ts`
- `src/pages/Register.tsx`
- `src/components/auth/SignUpForm.tsx`
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/customer-portal/index.ts`
- `supabase/functions/whatsapp-agent/index.ts`
- possivelmente um util/config compartilhado para domínio canônico
- documentação operacional (`CONFIGURACAO_SUPABASE.md`) se necessário para refletir o comportamento final

### Detalhes técnicos

- Substituir montagem dinâmica de URLs baseada no host atual por uma estratégia canônica, por exemplo:
  - produção: `https://donawilma.com.br`
  - desenvolvimento local: `http://localhost:5173`
  - preview apenas para navegação interna, nunca como base confiável de links enviados por e-mail ao cliente
- Garantir consistência entre:
  - Supabase Auth `redirectTo` / `emailRedirectTo`
  - Stripe `success_url` / `cancel_url` / `return_url`
  - links exibidos em mensagens automatizadas
- Preservar o fluxo robusto já existente de recuperação de senha (`index.html` + `main.tsx` + `App.tsx` + `ResetPassword.tsx`), porque ele está correto conceitualmente; o foco é impedir que o link inicial já nasça com domínio errado.

### Resultado esperado

Depois dessa correção:
- o e-mail de redefinição abrirá diretamente a rota correta,
- o e-mail de confirmação abrirá o callback correto,
- Stripe sempre voltará para as páginas corretas,
- mensagens automáticas não exibirão hosts errados,
- e o sistema deixará de cair na home por inconsistência de domínio/URL.

Aprovação dessa etapa me permite implementar as correções agora.