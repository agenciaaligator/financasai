# Revisão completa antes do teste

Fiz uma varredura nos pontos críticos. Resumo do que está implementado e funcionando, e um passo-a-passo recomendado para você criar a conta de teste.

## ✅ Status por fluxo

### 1. Onboarding e contratação de plano
- `Register` → `create-checkout` → Stripe Checkout → `PaymentSuccess` → `/boas-vindas`.
- Webhook Stripe trata `checkout.session.completed`, `subscription.updated`, `subscription.deleted`, `invoice.payment_failed` (vira `past_due` com 3 dias de graça) e `invoice.payment_succeeded` (volta a `active`).
- Idempotência via `stripe_subscription_id`. Admin role protegido contra sobrescrita.
- Email enviado imediatamente no signup via SMTP Hostinger (`send-app-email`).

### 2. Cancelamento de plano
- `customer-portal` ativo — usuário cancela pelo portal Stripe.
- Webhook marca `cancelled` em `subscription.deleted` e `useSubscription` redireciona para `/subscription-inactive`.

### 3. Boas-vindas
- `Welcome.tsx` mostra cards explicando que Google Agenda, categorias/metas, relatórios e configurações são feitos no painel web.
- Traduzido nos 5 locais.

### 4. WhatsApp — texto, áudio, imagem
- **Texto**: NLP no `whatsapp-agent` com regex de prioridade + Gemini fallback.
- **Áudio**: `whatsapp-webhook` baixa da Graph API, transcreve via ElevenLabs (com fallback Whisper) e injeta texto no agente. Fallback amigável se transcrição falhar (`__audio_transcription_failed__`).
- **Imagem**: OCR via Gemini Vision (`analyzeReceipt`) — extrai valor, data e estabelecimento, prioriza `due_date` para boletos. Confirmação antes de salvar.

### 5. Agendamento por áudio/texto + edição/cancelamento
- Intents detectadas: `agendar/marcar/criar/cadastrar`, `editar/alterar/remarcar`, `cancelar/excluir/apagar` compromisso.
- Conflito de horário, expediente e dia inativo verificados antes de salvar.
- Sincronização bidirecional com Google Calendar (`google-calendar-event`: create/update/delete).
- Cron `send-commitment-reminders-1h` rodando a cada 5 min (confirmado em `cron.job`, ativo). Idempotente via `commitments.reminder_sent_1h`.
- UI web (`AgendaPage`) permite criar/editar/excluir, com confirmação e aviso de conflito.

### 6. Conexão Google Agenda
- Só funciona pelo painel web (avisos visíveis na `AgendaPage` e em Welcome).
- Token revalidação via `needs_reauth`. Renovação de watches via cron diário.

## ⚠️ Pré-requisitos para o teste

1. **Stripe em modo correto**: as chaves `STRIPE_SECRET_KEY` e os `price_id` em `subscription_plans` precisam estar ambos em **test mode** OU ambos em **live mode** (memória já registrada). Para teste, recomendo modo test e use cartão `4242 4242 4242 4242`.
2. **Webhook Stripe**: `STRIPE_WEBHOOK_SECRET` deve corresponder exatamente ao endpoint configurado no Stripe.
3. **Telefone WhatsApp único**: o sistema bloqueia telefones já cadastrados. Use um número que ainda não foi usado, OU delete a conta antiga via admin antes.
4. **Email único**: idem — use email novo ou delete o anterior.

## 🧪 Roteiro sugerido de teste

```text
1. /register → preencher (email + telefone novos) → Stripe Checkout
2. Pagar com 4242 4242 4242 4242 → /boas-vindas
3. Definir senha (se solicitado)
4. Conectar Google Agenda no painel web (botão Conectar)
5. Validar WhatsApp via OTP enviado pela Wilma
6. WhatsApp: enviar texto "gastei 50 no almoço" → confirmar categoria
7. WhatsApp: enviar áudio descrevendo uma transação
8. WhatsApp: enviar foto de uma nota fiscal → confirmar OCR
9. WhatsApp: "agendar dentista amanhã 14h" → confirmar
10. Verificar evento no Google Agenda
11. WhatsApp: "editar compromisso 1" → mudar horário
12. WhatsApp: "cancelar compromisso 1"
13. Painel web → criar/editar/excluir compromisso pela UI
14. Aguardar 1h antes de um compromisso real para validar lembrete WhatsApp
15. Stripe Customer Portal → cancelar assinatura → verificar redirecionamento para /subscription-inactive
```

## 📋 Veredito

Tudo o que você pediu está implementado e os pontos críticos (cron ativo, webhooks, idempotência, RLS, traduções) foram conferidos. **Pode criar a conta de teste.**

Se quiser, posso preparar um botão "Reset de conta de teste" no admin para facilitar repetições — me avise.
