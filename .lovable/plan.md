
## Objetivo

Eliminar o looping do cadastro com correção estrutural, fechar as lacunas de feedback/segurança do fluxo e aplicar os ajustes combinados da Fase 2 no onboarding.

## O que encontrei ao revisar

1. O `Register.tsx` está no fluxo novo correto: `signUp()` → `create-checkout` → Stripe.
2. O contexto atual do projeto mostra um ponto crítico: **o banco está sem triggers ativos** (`<db-triggers>: There are no triggers in the database`).
3. Sem o trigger `on_auth_user_created`, o usuário pode ser criado em `auth.users`, mas **não ganha `profiles`, `organizations` e `organization_members`**. Isso é compatível com o sintoma de “fica carregando / looping”.
4. Há também desalinhamentos de onboarding:
   - `/boas-vindas` ainda mostra a etapa **“Email Confirmado”**
   - `/payment-success` ainda tem texto de **“enviamos um email”**
   - o fluxo visual ainda comunica um onboarding antigo, mesmo com `Confirm email` desligado.
5. Há uma lacuna de UX no cadastro: telefone duplicado ainda pode cair em erro genérico em vez de mensagem clara.

## Plano de implementação

### Fase 1 — Corrigir o looping de forma definitiva
1. **Validar e reaplicar os triggers no banco**
   - Recriar:
     - `on_auth_user_created` em `auth.users` → `public.handle_new_user_simple()`
     - `on_auth_user_created_role` em `public.profiles` → `public.handle_new_user_role()`
     - `on_profile_created_categories` em `public.profiles` → `public.create_default_categories()`
   - Verificar no banco que eles realmente ficaram ativos após a migration.

2. **Blindar o `Register.tsx` contra estado “órfão”**
   - Depois do `signUp()`, confirmar se o `profile` do usuário existe antes de chamar `create-checkout`.
   - Se o profile não existir após uma pequena espera/retry curto, interromper o fluxo com mensagem humana, sem deixar spinner infinito.
   - Isso evita depender cegamente do trigger.

3. **Adicionar timeout e fallback no checkout**
   - Colocar timeout controlado na chamada da edge function `create-checkout`.
   - Se demorar demais ou falhar:
     - sair do estado de redirecionamento,
     - mostrar erro claro,
     - exibir CTA para tentar novamente sem recarregar tudo.

4. **Tratar telefone duplicado com mensagem específica**
   - Detectar conflito de `phone_number` no cadastro.
   - Mostrar mensagem objetiva: telefone/WhatsApp já vinculado a outra conta.

### Fase 2 — Ajustar o onboarding para o fluxo real
1. **Remover a narrativa antiga de confirmação por email**
   - Atualizar `/payment-success`
   - Atualizar `/boas-vindas`
   - Atualizar stepper e microcopys
   - O fluxo correto passa a ser:

```text
Escolher plano -> Criar conta -> Pagamento -> Conectar WhatsApp -> Dashboard
```

2. **Revisar o stepper visual**
   - Etapas novas:
     - Conta criada
     - Pagamento confirmado
     - Conectar WhatsApp
   - Remover “Email confirmado”.

3. **Adicionar resumo do plano no `/register`**
   - Mostrar plano escolhido, cobrança mensal/anual, moeda/localização e CTA de continuidade.
   - Isso reduz insegurança antes do clique final.

4. **Melhorar feedback de processamento**
   - Trocar sensação de “travou” por estados claros:
     - criando conta
     - preparando pagamento
     - redirecionando para checkout
   - Sempre com saída visível em caso de erro.

### Fase 3 — Polimento de confiança no padrão SaaS bom
1. **Mensagens de segurança e clareza**
   - Deixar explícito no cadastro:
     - “Você criará sua conta agora”
     - “O pagamento abre na próxima etapa”
     - “Depois você conecta seu WhatsApp”
   - Sem textos técnicos nem alarmistas.

2. **Revisão de consistência do fluxo**
   - Garantir que `/payment-success`, `/auth/callback`, `/boas-vindas` e `/` não se contradigam.
   - Ajustar os redirects para que o usuário nunca pareça “preso”.

3. **Teste end-to-end completo**
   - Cadastro com email novo
   - Telefone novo
   - Telefone duplicado
   - Email duplicado
   - Falha proposital no checkout
   - Fluxo completo até WhatsApp e dashboard

## Detalhes técnicos

- A causa mais forte hoje é **backend estrutural**, não apenas UI: o projeto está reportando **zero triggers ativos**, e isso quebra a criação do ecossistema mínimo do usuário.
- Além disso, o frontend atual assume sucesso rápido demais:
  - entra em `redirecting`
  - chama checkout
  - não valida suficientemente a criação do profile antes da próxima etapa
- O onboarding também está semanticamente defasado porque ainda reflete o modelo antigo com confirmação de email.

## Resultado esperado após a implementação

- O cadastro para de “loopar”.
- Usuário novo avança com previsibilidade para o Stripe.
- Se algo falhar, ele recebe uma explicação clara e recuperável.
- O onboarding passa a refletir o fluxo real do produto, sem mensagens contraditórias.
- A Fase 2 já entra junto com os ajustes que você vinha cobrando, sem perder o foco no bug principal.
