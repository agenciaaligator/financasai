

# Correcao do Onboarding - Fluxo Unico e Linear

## Fluxo Real do Usuario (caminho unico)

```text
1. Landing Page -> clica em plano
2. /choose-plan -> escolhe mensal ou anual
3. /register?plan=monthly -> preenche nome, email, senha
4. Stripe Checkout (janela externa) -> paga
5. /payment-success -> usuario NAO tem sessao (email nao confirmado ainda)
6. Recebe email de confirmacao -> clica no link
7. /auth/callback -> detecta sessao, verifica assinatura
8. /boas-vindas -> conecta WhatsApp (obrigatorio)
9. Dashboard
```

---

## Problema Atual

- **PaymentSuccess** mostra botoes confusos ("Configurar WhatsApp", "Pular para dashboard") para um usuario que sequer tem sessao ativa
- **AuthCallback** redireciona para `/login` em vez de `/boas-vindas`
- A comunicacao entre telas nao guia o usuario de forma linear

---

## Alteracoes por Arquivo

### 1. PaymentSuccess.tsx

O usuario chega aqui apos pagar no Stripe. Na grande maioria dos casos, ele **NAO tem sessao** porque o email ainda nao foi confirmado.

**Novo comportamento:**

- **Estado "verificando"** (3 segundos): icone de loading + "Pagamento confirmado!"
- **Estado "sem sessao"** (caso principal):
  - Icone: CheckCircle verde
  - Titulo: "Pagamento confirmado!"
  - Mensagem: "Enviamos um email para ativar sua conta. Clique no link do email para comecar a usar o Dona Wilma."
  - Dica: "Nao recebeu? Verifique a pasta de spam."
  - Botao: "Ir para Login" (navega para `/login`)
- **Estado "com sessao + assinatura"** (raro, ex: usuario ja confirmou email rapidamente):
  - Auto-redirect para `/boas-vindas` apos 3 segundos
  - Botao manual: "Ir para boas-vindas"
- **Remover**: botao "Pular para dashboard" e botao "Configurar WhatsApp"

### 2. AuthCallback.tsx

O usuario chega aqui ao clicar no link de confirmacao do email.

**Alterar redirecionamento:**
- Quando `password_set = true` E assinatura ativa:
  - Redirecionar para `/boas-vindas` (em vez de `/login`)
  - Setar `sessionStorage.came_from_email_confirmation = true`
- Quando `password_set = false`: manter redirect para `/set-password`
- Quando sem assinatura: manter redirect para `/choose-plan`

### 3. Welcome.tsx - Adicionar barra de progresso visual

Manter toda a logica atual de conexao WhatsApp (funciona bem). Adicionar:

**Barra de progresso** no topo com 3 etapas:
1. "Conta Criada" - sempre check verde
2. "Email Confirmado" - check verde (usuario so chega aqui se confirmou)
3. "Conectar WhatsApp" - check verde se conectado, circulo azul pulsante se pendente

**Titulo atualizado:** "Parabens! Sua conta Dona Wilma esta ativa!"
**Subtitulo:** "Falta so conectar seu WhatsApp para comecar"

**Manter:**
- WhatsApp obrigatorio (botao "Ir para o sistema" continua desabilitado ate conectar)
- Card de dicas de uso
- Toda a logica de phone input, OTP e verificacao

**Botao final:** renomear de "Ir para o sistema" para "COMECAR A USAR DONA WILMA"

### 4. LoginForm.tsx - Banner contextual

- Verificar `sessionStorage.came_from_email_confirmation`
- Se presente, mostrar banner verde acima do formulario: "Email confirmado com sucesso! Entre com seus dados para acessar"
- Limpar flag apos exibir
- Nota: este banner so aparece se o usuario fez logout e voltou ao login manualmente, ja que o AuthCallback agora redireciona direto para /boas-vindas

### 5. Locales (5 arquivos: pt-BR, en-US, es-ES, pt-PT, it-IT)

Novas chaves:
- `paymentSuccess.confirmed`: "Pagamento confirmado!"
- `paymentSuccess.emailSent`: "Enviamos um email para ativar sua conta. Clique no link do email para comecar a usar o Dona Wilma."
- `paymentSuccess.checkSpam`: "Nao recebeu? Verifique a pasta de spam."
- `paymentSuccess.goToLogin`: "Ir para Login"
- `paymentSuccess.redirecting`: "Redirecionando para suas boas-vindas..."
- `welcome.congratulations`: "Parabens! Sua conta Dona Wilma esta ativa!"
- `welcome.connectToStart`: "Falta so conectar seu WhatsApp para comecar"
- `welcome.stepAccountCreated`: "Conta Criada"
- `welcome.stepEmailConfirmed`: "Email Confirmado"
- `welcome.stepConnectWhatsApp`: "Conectar WhatsApp"
- `welcome.startUsing`: "COMECAR A USAR DONA WILMA"
- `login.emailConfirmedBanner`: "Email confirmado com sucesso! Entre com seus dados"

---

## O que NAO muda

- Register.tsx - fluxo de cadastro intacto
- ChoosePlan.tsx - selecao de plano intacta
- create-checkout edge function - success_url continua /payment-success
- Index.tsx - ja redireciona para /boas-vindas se WhatsApp nao conectado
- Logica de conexao WhatsApp (phone, OTP, sessao)
- Banco de dados - nenhuma tabela ou coluna alterada

## Sobre o Email de Confirmacao

O template do email e editado no **Supabase Dashboard** (Authentication -> Email Templates). O link do email ja aponta para `/auth/callback`. Para alterar o assunto e corpo do email, editar manualmente no painel. Apos a implementacao, fornecerei o texto sugerido para voce colar la.
