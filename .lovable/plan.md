

## Diagnóstico — Bug Crítico no Onboarding

### O que aconteceu (procede 100%)

A página `/boas-vindas` (`src/pages/Welcome.tsx`) está exibindo as **chaves cruas** de tradução (`welcome.congratsTitle`, `welcome.connectMagicDesc`, `welcome.codeLabel`, etc.) em vez do texto traduzido. Isso quebra todo o passo final do onboarding — o usuário recebe o e-mail, clica no link, é redirecionado e vê uma tela ininteligível.

### Causa raiz

Na auditoria anterior eu adicionei um bloco `"welcome": { ... }` no nível raiz dos 5 arquivos `src/locales/*.json` para o componente `WelcomeScreen` (modal pós-signup). Acontece que **já existia** um bloco `"welcome": { ... }` no nível raiz desses mesmos arquivos, com todas as chaves usadas pela página `/boas-vindas` (`congratsTitle`, `connectMagicDesc`, `codeLabel`, `tipExpenses`, `startUsing`, etc.).

JSON com chaves duplicadas no mesmo nível: o **segundo bloco sobrescreve o primeiro**. Como o segundo só tem 15 chaves (modal), todas as chaves da página foram perdidas em todos os 5 idiomas.

```text
pt-BR.json:
  linha  494: "welcome": { ...60+ chaves da página /boas-vindas... }   ← perdido
  linha 1028: "welcome": { ...15 chaves do WelcomeScreen modal... }    ← vence
```

Mesma duplicação confirmada em `en-US.json`, `es-ES.json`, `it-IT.json`, `pt-PT.json`.

### Auditoria do fluxo de onboarding completo

```text
Landing → "Começar agora"
   ↓
/choose-plan  (escolha mensal/anual)
   ↓
/cadastro  (SignUpForm: nome, email, telefone, senha → OTP WhatsApp)
   ↓ [signUp() dispara email de confirmação]
WelcomeScreen modal aparece em cima do SignUp (com plano + CTA checkout)
   ↓
Stripe Checkout → /payment-success
   ↓
Email de confirmação chega → usuário clica link → /auth/callback
   ↓
AuthCallback verifica subscription:
   - sem assinatura → /choose-plan
   - com assinatura → /boas-vindas   ← AQUI APARECE A TELA QUEBRADA
   ↓
/boas-vindas (Welcome.tsx) → conecta WhatsApp via OTP → "/" (dashboard)
```

**Outros pontos do onboarding inspecionados — sem problemas funcionais:**
- `AuthCallback` redireciona corretamente (com/sem assinatura).
- `Welcome.tsx` tem lógica robusta: detecta sessão WhatsApp existente, valida telefone E.164, reenvio de código, mensagens de erro localizadas.
- Rota `/boas-vindas` registrada corretamente no `App.tsx`.

O único bloqueio real é a **renderização das traduções**.

### Correção (1 ação, 5 arquivos)

Para cada arquivo `src/locales/{pt-BR,en-US,es-ES,it-IT,pt-PT}.json`:

1. Localizar os DOIS blocos `"welcome": { ... }` no nível raiz.
2. **Mesclar** os dois objetos em um único bloco `"welcome": { ... }`, preservando TODAS as chaves de ambos.
   - O primeiro bloco (página `/boas-vindas`) tem ~60 chaves: `congratsTitle`, `congratsSubtitle`, `defaultUser`, `connectWhatsApp`, `connectMagicDesc`, `stepAccountCreated`, `stepEmailConfirmed`, `stepConnectWhatsApp`, `phoneLabel`, `phoneHint`, `sendCode`, `sending`, `codeLabel`, `codePlaceholder`, `codeHint`, `back`, `verify`, `verifying`, `resendCode`, `connected`, `number`, `readyToUse`, `tipsHowTo`, `tipExpenses`, `tipExpensesExample`, `tipIncome`, `tipIncomeExample`, `tipBalance`, `tipBalanceExample`, `tipPhotos`, `tipPhotosExample`, `startUsing`, `invalidNumber`, `invalidNumberDesc`, `numberAlreadyRegistered`, `numberAlreadyRegisteredDesc`, `whatsappInUse`, `whatsappInUseDesc`, `codeSent`, `codeSentDesc`, `sendError`, `invalidCode`, `invalidCodeDesc`, `connectedSuccess`, `connectedSuccessDesc`, etc.
   - O segundo bloco (modal `WelcomeScreen`) tem 15 chaves: `greeting`, `accountReady`, `orderSummary`, `plan`, `price`, `monthly`, `yearly`, `perMonth`, `perYear`, `getStarted`, `tip1`, `tip2`, `tip3`, `goToDashboard`, `viewSubscription`.
   - Não há colisão de nomes entre os dois blocos — merge é direto.
3. Remover o segundo bloco duplicado.
4. Validar que cada arquivo continua sendo JSON válido (`JSON.parse`).

Vou escrever um script Node que faz o merge automaticamente nos 5 arquivos preservando ordem e indentação.

### Verificação extra (preventivo)

Mesmo script vai escanear cada locale por **outras chaves duplicadas** no nível raiz e reportar — se houver outra duplicação além de `welcome`, corrigir no mesmo passo.

### Arquivos afetados (5)

- `src/locales/pt-BR.json`
- `src/locales/en-US.json`
- `src/locales/es-ES.json`
- `src/locales/it-IT.json`
- `src/locales/pt-PT.json`

### Resultado esperado

Usuário clica no link do email → `/auth/callback` → `/boas-vindas` exibe corretamente: "Parabéns, [Nome]!", subtítulo, formulário "Conectar WhatsApp", grid de dicas, botão "Começar a usar Dona Wilma" — tudo no idioma do usuário.

