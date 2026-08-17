# Lançar sem a Agenda (modo "Em breve")

Objetivo: desativar temporariamente a funcionalidade de agenda/Google Calendar sem apagar nada, para lançar o sistema com segurança enquanto o Google não aprova a verificação. Tudo volta ligando um único interruptor.

## Como funciona o interruptor

Uma flag central (`CALENDAR_ENABLED = false`) em `src/lib/featureFlags.ts`. Quando o Google aprovar, muda para `true` e a agenda reaparece inteira, sem refazer código.

## O que muda para o usuário

**Painel (admin/dashboard)**
- Aba "Agenda" sai da sidebar e das abas do dashboard.
- Badge "Conectar Agenda / Agenda conectada" no topo do dashboard fica oculto.
- Rotas `/conectar-agenda` e `/agenda` passam a redirecionar para o dashboard.
- Bloco de conexão do Google na tela de Perfil fica oculto.

**Boas-vindas / onboarding**
- Passo "Conectar Google Agenda" removido da mensagem de boas-vindas, mantendo o fluxo linear (Pagamento → E-mail → Boas-vindas → WhatsApp) intacto.

**WhatsApp**
- Se o usuário pedir para agendar algo ("agendar dentista amanhã às 11h", áudio, etc.), a Dona Wilma responde com aviso amigável de que a agenda está em fase final de aprovação e chega em breve, e segue oferecendo ajuda com finanças.
- Nenhum compromisso é criado e nenhuma chamada ao Google é feita nesse período (zero risco de erro 403 na frente do cliente).
- Todo o resto do agente (despesas, receitas, OCR, áudio, recorrentes, metas, franquia de mensagens) continua igual.

**Landing page e planos**
- Seção da Google Agenda, itens de plano e FAQ relacionados ganham selo **"Em breve"**, sem prometer que já funciona.
- Textos ajustados nos 5 idiomas para não afirmar que a sincronização já está ativa.

## Custos e backend

- O cron diário `renew-google-watches` (03:00 UTC) e o cron de lembretes de compromisso passam a sair imediatamente sem consultar nada enquanto a flag estiver desligada — nenhum consumo extra de Supabase nem de mensagens pagas do WhatsApp.
- Nada é removido do banco: tabelas `commitments` e `calendar_connections`, edge functions e migrações permanecem como estão.

## Detalhes técnicos

1. `src/lib/featureFlags.ts`: exportar `CALENDAR_ENABLED = false`.
2. Guardas de UI: `AppSidebar.tsx` (item agenda), `FinancialDashboard.tsx` (tab agenda + handler do retorno OAuth), `DashboardContent.tsx` (badge + `currentTab === "agenda"`), `ProfileSettings.tsx` (bloco Google), `App.tsx` (rotas), `Welcome.tsx` (passo da agenda).
3. `whatsapp-agent`: nova checagem por env `CALENDAR_ENABLED` (default off) no roteador de intenção de compromisso → retorna a mensagem "em breve" antes de qualquer criação/sync. Estados de conversa de compromisso ficam inalcançáveis.
4. `send-commitment-reminders`, `renew-google-watches`, `google-calendar-sync`: early return `{ disabled: true }` quando a flag estiver off.
5. Landing: selo "Em breve" em `Index.tsx` (bloco calendar), `PlansSection.tsx`, `FAQSection.tsx` + chaves novas/ajustadas em `src/locales/*.json`.
6. Reativação futura: flag para `true` + variável de ambiente no Supabase, sem outras mudanças.
