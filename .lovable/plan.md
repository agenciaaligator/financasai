## Plano para eliminar os 404 em `/login` e `/reset-password`

1. Confirmar a origem correta da publicação
- Considerar `https://donawilma.lovable.app` como a referência funcional atual, porque nela `/login` e `/reset-password` já abrem corretamente.
- Tratar `donawilma.com.br` como configuração de domínio/hosting, não como bug do React Router.

2. Corrigir o apontamento do domínio público
- Conectar `donawilma.com.br` e `www.donawilma.com.br` diretamente em **Project Settings → Domains** no Lovable, se ainda não estiverem conectados.
- Definir um deles como **Primary** e deixar o outro apenas redirecionar para o principal.
- Ajustar o DNS no provedor para apontar para o Lovable conforme a configuração exibida no painel.
- Remover conflitos antigos de hospedagem (Hostinger/Vercel) que ainda estejam respondendo pelo domínio.

3. Eliminar conflito entre provedores
- Revisar os registros DNS e qualquer forwarding ativo para garantir que o mesmo domínio não esteja dividido entre ambientes diferentes.
- Garantir que não existam respostas híbridas como as atuais:
  - `/login` retornando página 404 da Hostinger
  - `/reset-password` retornando 404 da Vercel
- Se houver registros antigos de A, CNAME, redirect ou proxy, consolidar tudo para um único destino.

4. Validar as rotas críticas após a troca
- Testar no domínio final:
  - `/`
  - `/login`
  - `/reset-password`
  - `/auth/callback`
  - `/register`
  - `/payment-success`
  - `/admin`
- Confirmar que todas carregam o app e que o fallback SPA está funcionando no host correto.

5. Fechar a validação dos fluxos de autenticação
- Depois que o domínio estiver servindo o app certo, executar os testes reais de:
  - login
  - recuperação de senha
  - cadastro com confirmação por e-mail
- Confirmar que os links do Supabase abrem no domínio oficial sem 404.

## O que já foi confirmado
- No código, as rotas existem e estão corretas em `src/App.tsx`.
- Em `https://donawilma.lovable.app`:
  - `/login` funciona
  - `/reset-password` funciona
- Em `https://donawilma.com.br`:
  - a home abre
  - `/login` retorna 404 da Hostinger
  - `/reset-password` retorna 404 da Vercel

## Conclusão técnica
Isso indica um problema de infraestrutura/publicação, não de código da aplicação. O domínio público ainda não está apontando de forma limpa para uma única origem.

## Detalhes técnicos
```text
Situação atual observada:
- Código da SPA: OK
- Publicação Lovable: OK
- Domínio customizado: inconsistente
- Resposta por rota profunda: vinda de provedores diferentes

Diagnóstico:
DNS/hosting ainda está misturado entre Hostinger, Vercel e/ou publicação fora do Lovable.
Enquanto isso não for unificado, links como /login e /reset-password continuarão dando 404.
```

## Resultado esperado
Ao final, `donawilma.com.br` deverá servir exatamente o mesmo app que hoje já funciona em `donawilma.lovable.app`, inclusive nas rotas internas acessadas diretamente.
