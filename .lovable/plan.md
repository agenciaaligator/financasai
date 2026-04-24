## Objetivo
Fazer o fluxo de recuperação de senha funcionar de ponta a ponta e deixar todas as URLs/rotas alinhadas ao domínio final, preservando o que já está estável.

## Diagnóstico confirmado
Hoje o principal bloqueio não está só no React/Supabase:

- O app responde corretamente em `donawilma.lovable.app` nas rotas internas como `/reset-password`, `/auth/callback` e `/set-password`.
- No domínio `donawilma.com.br`, essas rotas profundas retornam `404`.
- O domínio ainda redireciona para `www.donawilma.com.br`, e esse host também devolve `404` nas rotas internas.
- Resultado: quando o usuário clica no link de recuperação, o Supabase abre o domínio novo, mas esse domínio não está servindo corretamente as rotas SPA do app; por isso o fluxo quebra e o usuário acaba fora da tela esperada.
- Além disso, ainda existem referências antigas a `donawilma.lovable.app` em funções do WhatsApp e em documentação interna, o que impede fechar a auditoria de URLs com segurança.

## Plano
### 1. Corrigir a origem publicada do domínio
- Confirmar qual host será o oficial: `https://donawilma.com.br` ou `https://www.donawilma.com.br`.
- Ajustar a publicação para que esse domínio aponte para o app que está rodando no Lovable, com fallback SPA funcionando para todas as rotas internas.
- Validar especificamente estas rotas no domínio final:
  - `/`
  - `/reset-password`
  - `/set-password`
  - `/auth/callback`
  - `/boas-vindas`
  - `/payment-success`
  - `/payment-cancelled`
  - `/subscription-inactive`
  - `/termos`
  - `/privacidade`

### 2. Fechar o fluxo de recuperação de senha no frontend
- Revisar o fluxo atual de recovery para garantir que, ao detectar `type=recovery`, nada mais redirecione o usuário para a home antes da tela de reset.
- Tornar o redirecionamento para `/reset-password` ainda mais defensivo para funcionar mesmo quando o link chegar por hash, sessão restaurada ou evento `PASSWORD_RECOVERY`.
- Garantir compatibilidade entre `/reset-password` e `/set-password` sem alterar o fluxo de onboarding já funcional.

### 3. Padronizar URLs de autenticação no Supabase
- Definir o `Site URL` com o domínio oficial único.
- Revisar a lista de `Redirect URLs` para cobrir produção e, se necessário, o domínio Lovable apenas como contingência controlada.
- Garantir que cadastro, confirmação de e-mail e recuperação de senha usem a mesma base de domínio.

### 4. Limpar referências antigas de domínio no código
- Substituir referências remanescentes de `donawilma.lovable.app` por URLs finais onde isso impacta usuário ou integrações.
- Revisar especialmente:
  - Edge functions de WhatsApp
  - textos com links enviados ao cliente
  - customer portal / checkout fallbacks
  - documentação interna de configuração

### 5. Fazer auditoria final de rotas e URLs
- Mapear todas as rotas públicas e autenticadas do app.
- Conferir quais dependem de acesso direto por link, e-mail, Stripe ou WhatsApp.
- Entregar uma checklist final com o que ficou:
  - correto no código
  - correto no Supabase
  - correto no domínio publicado
  - corrigido nas integrações

## Entregáveis
- Fluxo de “Esqueci minha senha” abrindo a tela correta no domínio final
- Domínio oficial respondendo sem 404 nas rotas internas principais
- URLs do Supabase alinhadas e sem conflito
- Referências antigas ao `.lovable.app` removidas dos pontos críticos
- Checklist final de URLs/rotas para você liberar o sistema

## Detalhes técnicos
```text
Fluxo esperado:
Email do Supabase
  -> domínio oficial
  -> /reset-password ou /auth/callback com tokens/hash
  -> app captura sessão/token
  -> tela de redefinição
  -> atualização de senha
  -> redirecionamento final controlado
```

## Observação importante
O maior problema hoje é de publicação/domínio, não apenas de código. Mesmo com o fluxo de recovery já reforçado no app, ele continuará falhando enquanto `donawilma.com.br` e `www.donawilma.com.br` não servirem corretamente as rotas SPA do projeto.

Quando você aprovar, eu sigo com a implementação e a auditoria completa, sem mexer no que já está funcionando.