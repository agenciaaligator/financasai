

## Diagnóstico do build error

O build quebrou após o último ajuste de CSS no `Register.tsx`. A causa provável são os seletores arbitrários do Tailwind:

```
[&:-webkit-autofill]:[-webkit-text-fill-color:white]
[&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]
```

Tailwind tem dificuldade com pseudo-classes vendor-prefixed (`-webkit-autofill`) dentro de `[&:...]` porque o parser pode interpretar o `:` como início de variant. Resultado: erro de PostCSS/Tailwind no build de produção (mesmo que o preview tenha continuado funcionando com cache).

## Plano de correção (1 arquivo, 3 inputs)

**`src/pages/Register.tsx`** — simplificar o `className` dos 3 `<Input>` (Nome, Email, Senha) removendo os seletores problemáticos de autofill e mantendo apenas o essencial que resolve o problema de contraste:

Trocar:
```
!bg-white/10 !text-white border-white/20 placeholder:text-white/40 focus-visible:!bg-white/15 [-webkit-text-fill-color:white] [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s]
```

Por:
```
!bg-white/10 !text-white border-white/20 placeholder:text-white/40 focus-visible:!bg-white/15
```

Para resolver o autofill amarelo do Chrome (que esconderia o texto), adicionar uma regra global em **`src/index.css`** (1 bloco, sem Tailwind arbitrário, 100% compatível com o build):

```css
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: white !important;
  -webkit-box-shadow: 0 0 0 1000px rgba(255,255,255,0.10) inset !important;
  transition: background-color 9999s ease-in-out 0s;
  caret-color: white;
}
```

Essa regra é escopo global mas só dispara no estado de autofill do navegador — não afeta inputs normais em outras páginas.

## Posso divulgar depois disso?

Resposta direta: **depois desse fix do build + um teste end-to-end seu de 5 minutos, sim.**

Resumo de tudo que foi blindado nos últimos turnos:

| Camada | Status |
|---|---|
| Cadastro com inputs legíveis | 🔧 corrigir build agora |
| Email de confirmação Supabase | ✅ |
| `/boas-vindas` sem assinatura → `/escolher-plano` | ✅ |
| Dashboard sem assinatura → bloqueado (`useSubscriptionGuard`) | ✅ |
| WhatsApp claim code sem assinatura → recusa | ✅ |
| **WhatsApp agent sem assinatura → bloqueia mensagem** (correção pós-MARINES) | ✅ |
| Sessão órfã da MARINES removida | ✅ |
| RLS de `whatsapp_validation_codes` (OTP escondido do cliente) | ✅ |
| RLS de `organization_invitations` (DELETE) | ✅ |
| Idempotência do Stripe webhook | ✅ |
| Proteção de role admin no webhook | ✅ |

O caso da MARINES **não pode mais se repetir**: agora o agente recusa interagir antes de validar `user_subscriptions.status in ('active','trialing')`. Mesmo que sobre alguma sessão antiga, o agente bloqueia na primeira mensagem.

## Recomendação antes de divulgar em massa

1. Aplicar o fix do build (próximo passo após você aprovar este plano).
2. Você criar **1 conta nova de teste** com email descartável e seguir o fluxo: cadastro → pagamento → email → boas-vindas → WhatsApp. ~5 min.
3. Em paralelo, criar **1 conta sem pagar** e confirmar que: dashboard bloqueia, WhatsApp não valida, agente não responde.
4. Se ambos passarem, **pode divulgar com tranquilidade**.

Não recomendo divulgar antes do passo 2/3 — não por desconfiança das defesas, mas porque um teste real seu vale mais do que qualquer revisão de código.

