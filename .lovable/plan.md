## Diagnóstico

O erro 403 do Google ao reconectar indica que o fluxo OAuth está chegando no Google, mas a conta/projeto OAuth não está autorizando a página. Também encontrei uma conexão antiga da Google Agenda no banco marcada como `is_active = false`, com token expirado, e o app depende da reconexão para voltar a sincronizar.

## Plano de correção

1. **Corrigir o fluxo de reconexão no app**
   - Revisar `useGoogleCalendar.connect()` para iniciar o OAuth com tratamento de erro mais claro.
   - Garantir que, ao voltar do callback com `connected=true`, a conexão seja recarregada antes de sincronizar.
   - Melhorar a mensagem da tela Agenda quando a conta está inativa/expirada.

2. **Fortalecer as Edge Functions do Google Calendar**
   - `google-calendar-auth`: validar e registrar a URL de redirect usada, gerar `state` seguro e retornar mensagens úteis quando faltar configuração.
   - `google-calendar-callback`: tratar erros reais do Google (`access_denied`, `redirect_uri_mismatch`, `invalid_client`, etc.) e redirecionar para o app com uma mensagem compreensível.
   - Garantir que reconexão atualize `is_active=true`, `needs_reauth=false`, `calendar_id='primary'` e preserve `refresh_token` se o Google não devolver um novo.

3. **Corrigir consistência da sincronização**
   - `google-calendar-sync` e `google-calendar-event`: diferenciar conta inexistente, conta inativa e necessidade de reconectar, em vez de erro genérico.
   - Se o token expirar e não puder ser renovado, marcar `needs_reauth=true` e orientar reconexão.
   - No agente do WhatsApp, manter o compromisso salvo localmente, mas só prometer Google Calendar quando o evento realmente for criado no Google.

4. **Verificar configuração crítica de OAuth**
   - Confirmar no código qual `GOOGLE_CALENDAR_REDIRECT_URI` precisa estar cadastrado no Google Cloud.
   - A URL autorizada deve ser exatamente:

```text
https://fsamlnlabdjoqpiuhgex.supabase.co/functions/v1/google-calendar-callback
```

   - Se o Google continuar exibindo 403 após as correções, a causa restante será configuração no Google Cloud: app em modo teste sem o e-mail autorizado, escopo não aprovado, OAuth Client errado ou redirect URI divergente.

5. **Validação após implementar**
   - Deploy das funções alteradas.
   - Teste do início do OAuth pela função `google-calendar-auth`.
   - Conferência dos logs das funções `google-calendar-auth` e `google-calendar-callback`.
   - Depois você deverá clicar novamente em “Reconectar Google Agenda” e concluir o consentimento no Google.

## Observação importante

Código pode corrigir o fluxo e as mensagens, mas um 403 exibido diretamente na página do Google também pode exigir ajuste manual no Google Cloud Console. A correção deixará isso explícito para sabermos exatamente se o bloqueio está no app ou na configuração OAuth do Google.