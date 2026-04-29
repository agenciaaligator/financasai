## Diagnóstico

O agendamento foi salvo corretamente no sistema, mas não apareceu no Google Agenda porque a conexão Google do usuário está marcada como inativa no banco:

```text
calendar_email: adwords@aligator.com.br
is_active: false
needs_reauth: false
google_event_id do compromisso: vazio
```

Como o `whatsapp-agent` só sincroniza quando encontra uma conexão Google com `is_active = true`, ele não tentou criar o evento no Google e retornou a mensagem de falha parcial.

Também encontrei dois problemas de experiência:

- A tela de Agenda trata qualquer conexão com `needs_reauth = false` como “Conectado”, mesmo quando `is_active = false`.
- A resposta do WhatsApp sempre promete “Google Calendar: 24h, 2h, 1h e 30min antes”, mesmo quando a sincronização falhou.

## Plano de correção

1. **Corrigir a lógica de status da conexão Google**
   - No painel de Agenda, considerar conectado somente quando `is_active = true` e `needs_reauth = false`.
   - Se existir conexão inativa, mostrar aviso claro para reconectar em vez de “Conectado”.

2. **Melhorar a resposta do WhatsApp quando o Google não sincronizar**
   - Quando não houver conexão ativa, não listar os lembretes do Google como configurados.
   - Informar de forma direta: “Compromisso salvo, mas sua Google Agenda precisa ser reconectada.”
   - Manter os lembretes do WhatsApp como configurados.

3. **Tornar a sincronização mais autoexplicativa no backend**
   - Ajustar `syncWithGoogleCalendar` para diferenciar:
     - sem conexão ativa,
     - conexão inativa,
     - reconexão necessária,
     - erro real da API Google.
   - Logar o motivo exato para facilitar depuração futura.

4. **Garantir que a reconexão resolva o caso atual**
   - Após o usuário clicar em “Reconectar Google Agenda”, o callback já atualiza `is_active = true`, `needs_reauth = false`, `access_token` e `refresh_token`.
   - Depois disso, novos agendamentos pelo WhatsApp devem receber `google_event_id` e aparecer no Google Agenda.

5. **Validação pós-correção**
   - Consultar o banco para confirmar que a conexão atual aparece como inativa antes da reconexão.
   - Validar que a interface não mostra mais “Conectado” para conexão inativa.
   - Após reconectar e testar novo agendamento, verificar se o compromisso recebeu `google_event_id`.

## Arquivos a ajustar

- `src/hooks/useGoogleCalendar.ts`
- `src/components/dashboard/AgendaPage.tsx`
- `supabase/functions/whatsapp-agent/index.ts`

## Ação necessária do usuário depois da correção

Você precisará reconectar a conta Google no painel de Agenda, porque a conexão atual está desativada. Depois disso, envie novamente pelo WhatsApp:

```text
agendar dentista amanhã às 11h
sim
```

O novo compromisso deve aparecer no Google Agenda.