
# Reformulacao do Fluxo Pos-Pagamento

## Situacao Atual

1. **stripe-webhook**: Cria usuario com `email_confirm: true` e envia `resetPasswordForEmail()` -- que usa o template **padrao de recovery** do Supabase (generico, em ingles, com linguagem de "reset")
2. **PaymentSuccess.tsx**: Tela confusa com textos sobre "confirmar email", campo para reenviar confirmacao, e multiplos passos desnecessarios
3. **ResetPassword.tsx**: Usa linguagem de "recuperacao de senha" em vez de "definir senha" -- apos sucesso redireciona para `/` (login) em vez de `/boas-vindas`
4. **Nao existe** edge function `custom-auth-emails` para personalizar o email enviado
5. **Nenhuma** dessas paginas esta internacionalizada (i18n)

## Plano de Implementacao

### 1. Criar Edge Function `custom-auth-emails`

Nova edge function que intercepta emails do Supabase Auth e envia email personalizado em portugues.

- Recebe o hook do Supabase Auth para tipo `recovery`
- Envia email com:
  - Assunto: "Sua conta Dona Wilma foi criada -- Defina sua senha"
  - Corpo profissional com botao "Definir minha senha"
  - Link apontando para `/reset-password` com os tokens
- Usa o Supabase Auth Hook (Send Email) ja configurado na migration existente
- **Custo**: Zero (usa SMTP nativo do Supabase, nao precisa de Resend)

**Importante**: O hook `custom-auth-emails` ja esta habilitado na migration `20250712234716`, mas a funcao nao existe. Precisamos cria-la.

### 2. Simplificar `PaymentSuccess.tsx`

Remover todo o conteudo complexo. Nova tela simples:

- Icone de sucesso (check verde)
- Titulo: "Pagamento Confirmado!"
- Subtitulo: "Enviamos um email para voce definir sua senha e acessar sua conta."
- Botao: "Ir para o Login" (para usuarios que ja definiram a senha)
- Rodape: "Verifique sua caixa de entrada e spam"

**Remover**:
- Campo de email para reenvio
- Textos sobre "confirmar email"
- Secao de passos (KeyRound, Mail, MessageCircle)
- Botao "Reenviar Email de Confirmacao"

Para usuarios ja logados: manter redirecionamento para `/boas-vindas`.

### 3. Atualizar `ResetPassword.tsx`

Mudar linguagem de "recuperacao" para "definicao de senha":

- Titulo: "Defina sua Senha" (em vez de "Nova Senha")
- Subtitulo: "Crie uma senha para acessar sua conta"
- Botao: "Definir Senha" (em vez de "Alterar Senha")
- Loading: "Definindo senha..." (em vez de "Alterando senha...")
- Apos sucesso: redirecionar para `/boas-vindas` (em vez de `/`)

### 4. Internacionalizar ambas as paginas

Adicionar chaves i18n para `PaymentSuccess` e `ResetPassword` nos 5 locales.

### 5. Registrar a edge function no `config.toml`

Adicionar `[functions.custom-auth-emails]` com `verify_jwt = false`.

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/custom-auth-emails/index.ts` | **Criar** -- edge function para emails personalizados |
| `supabase/config.toml` | Adicionar entrada para `custom-auth-emails` |
| `src/pages/PaymentSuccess.tsx` | Simplificar para tela limpa e profissional |
| `src/pages/ResetPassword.tsx` | Mudar linguagem para "definir senha", redirecionar para `/boas-vindas` |
| `src/locales/pt-BR.json` | Adicionar chaves `paymentSuccess.*` e `resetPassword.*` |
| `src/locales/en-US.json` | Adicionar chaves traduzidas |
| `src/locales/es-ES.json` | Adicionar chaves traduzidas |
| `src/locales/it-IT.json` | Adicionar chaves traduzidas |
| `src/locales/pt-PT.json` | Adicionar chaves traduzidas |

## O que NAO muda

- `stripe-webhook/index.ts` -- ja cria usuario com `email_confirm: true` e envia `resetPasswordForEmail()` corretamente
- Logica de criacao de conta automatica
- Logica de assinatura e roles
- Fluxo do Stripe Checkout
- Desktop/mobile layout

## Consideracao sobre o Email

O Supabase Auth Hook "Send Email" ja esta configurado para apontar para `custom-auth-emails`. A edge function recebera o evento com `type: "recovery"`, o email do usuario e o token. Ela deve retornar o email formatado em HTML com o link correto.

Como o projeto usa SMTP nativo do Supabase (sem Resend), a edge function precisa usar a API admin do Supabase ou retornar o HTML para o hook processar. A abordagem mais simples e o hook retornar o email customizado que o Supabase envia via seu SMTP interno.
