## Diagnóstico

O erro continua vindo da função **whatsapp-agent** ao confirmar o compromisso. Os logs recentes mostram exatamente:

```text
ReferenceError: syncWithGoogleCalendar is not defined
at Function.handleCommitmentConfirmation
```

Também confirmei que:

- O compromisso chega a ser salvo no banco antes da falha.
- A falha acontece logo depois, na etapa de sincronizar com Google Calendar.
- O aviso por e-mail/screenshot parece ser o diff de código da função, mas a imagem está muito comprimida; o erro real e acionável está nos logs da Edge Function.
- O código local já contém `syncWithGoogleCalendar`, mas a função publicada ainda está executando uma versão/empacotamento onde essa referência não existe no escopo correto.

## Plano de correção

1. **Corrigir o escopo da sincronização no whatsapp-agent**
   - Remover a dependência frágil da chamada direta `syncWithGoogleCalendar(...)` dentro dos métodos estáticos.
   - Substituir por um helper estável no mesmo escopo usado pelo runtime da função, ou por uma chamada interna controlada à Edge Function `google-calendar-event`/Google API.
   - Garantir que, mesmo se o Google Calendar falhar, o usuário não receba a mensagem genérica de erro depois que o compromisso já foi salvo.

2. **Evitar compromissos órfãos/duplicados quando a confirmação falha**
   - Ajustar o fluxo para não salvar múltiplas vezes se o usuário reenviar “Confirmar”.
   - Usar o `pending_commitment.commitment_id` ou uma busca por mesmo usuário/data/título antes de inserir novamente.
   - Limpar o estado da sessão após sucesso real para impedir repetição do mesmo agendamento.

3. **Melhorar a resposta do WhatsApp**
   - Se o compromisso for salvo mas a sincronização com Google falhar, responder algo claro como:
     - “Compromisso salvo, mas não consegui sincronizar com Google Agenda agora. Você pode sincronizar pelo painel.”
   - Se tudo der certo, responder confirmação normal.

4. **Verificar configuração e deploy da função**
   - Garantir que `whatsapp-agent` continue com `verify_jwt = false` no `supabase/config.toml`.
   - Confirmar que os segredos necessários existem sem expor valores:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `WHATSAPP_ACCESS_TOKEN`
     - `WHATSAPP_PHONE_NUMBER_ID`
   - Depois da correção, redeployar explicitamente a Edge Function `whatsapp-agent` para não depender apenas do deploy automático.

5. **Validar ponta a ponta**
   - Testar a função implantada com um fluxo equivalente a “agendar dentista amanhã 11h” e “confirmar”.
   - Conferir logs novos do `whatsapp-agent` para garantir que não aparece mais `syncWithGoogleCalendar is not defined`.
   - Conferir no banco se o compromisso foi criado uma única vez e se recebeu `google_event_id` quando a agenda estiver conectada.

## Arquivos envolvidos

- `supabase/functions/whatsapp-agent/index.ts`
- `supabase/functions/_shared/google-token.ts` somente se for necessário ajustar import/uso do token
- `supabase/config.toml` somente se alguma função de agenda estiver sem configuração correta

## Resultado esperado

Ao enviar “agendar dentista amanhã 11h” e depois “confirmar”, o agente deve:

1. confirmar o pedido,
2. salvar um único compromisso,
3. verificar/sincronizar com Google Calendar quando houver conexão ativa,
4. responder ao WhatsApp com sucesso ou com uma mensagem clara de falha parcial, sem a mensagem genérica de dificuldade.