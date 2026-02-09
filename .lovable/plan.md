# MVP de Produção - Reset Concluído

## Status: ✅ EXECUTADO

## Edge Functions Essenciais ao MVP (mantidas)
- `whatsapp-webhook` - Inbound WhatsApp
- `whatsapp-agent` - Processamento de mensagens (com idempotência por message_id)
- `stripe-webhook` - Pagamentos automáticos
- `create-checkout` - Checkout Stripe
- `check-subscription` - Verificação de assinatura (reativa, sem background)
- `customer-portal` - Portal do cliente Stripe
- `make-webhook` - Webhook de integração
- `whatsapp-session-set-org` - Sessão WhatsApp

## Removido
- 20 edge functions (Google Calendar, cron jobs, team, AI reports, trials, backfill)
- Componentes: CommitmentsManager, GoogleCalendarOnboarding, AIReportsChat, TeamManagement, WorkHoursSettings
- Hooks: useGoogleCalendar
- Páginas: GCBridge, GCAuthResult, InviteAccept
- Realtime subscriptions (useTransactions, ProfileSettings)
- Background intervals (main.tsx - verificação de versão a cada 30s)
- retryFetch (sem retries automáticos)
- Polling de WhatsApp (ProfileSettings)
- Documentação obsoleta (CRON_JOB_SETUP.md, GOOGLE_CALENDAR_CRON_SETUP.md, LEMBRETES_E_GOOGLE_CALENDAR.md)

## Garantias
- ✅ check-subscription: chamada apenas via useSubscriptionStatus (debounce 500ms, cooldown 2s, sem interval/retry)
- ✅ whatsapp-agent: idempotência por message_id (dedupe 10min no agent + 15min no webhook)
- ✅ Nenhuma função roda em background
- ✅ Nenhuma notificação automática
- ✅ Recorrências são informativas (classificação/sugestão), sem cobranças ou lembretes ativos
- ✅ Zero retry automático, zero processamento em lote, zero auto-followup
