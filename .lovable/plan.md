# Auditoria — Bloco #6: Severidade Média

Todos os pontos críticos (segurança, custos, erros silenciosos) já foram resolvidos nos blocos anteriores. Agora vou avançar nos itens de severidade média: **consistência de idioma, mensagens hardcoded e polimento de UX**.

## Escopo desta rodada

### 1. i18n — Toasts e mensagens hardcoded em pt-BR
Vários hooks e componentes ainda têm strings fixas em português, quebrando a experiência dos usuários em en-US, es-ES, it-IT e pt-PT.

Arquivos com strings hardcoded confirmados:
- `src/hooks/useRecurringTransactions.ts` — toasts de criar/editar/deletar recorrência
- `src/hooks/useCommitments.ts` — toast de erro de carregamento (acabou de ser adicionado hardcoded)
- `src/hooks/useMonthlyGoals.ts` — toast de erro de carregamento
- `src/hooks/useCategoryPatterns.ts` — mensagens de aprendizado de categoria
- `src/components/RecurringTransactionForm.tsx` — labels e validações
- `src/components/CategoryManager.tsx` — confirmações e placeholders
- `src/pages/PaymentSuccess.tsx` / `PaymentCancelled.tsx` — verificar chaves faltantes

**Ação:** trocar strings por `t('...')` e adicionar as chaves nos 5 arquivos de locale (`pt-BR`, `pt-PT`, `en-US`, `es-ES`, `it-IT`).

### 2. UX — Mensagens de erro do agente WhatsApp
Auditar as respostas de erro do `whatsapp-agent` para garantir que:
- Falhas de OCR, transcrição de áudio e Gemini retornem mensagens amigáveis (não stack trace)
- Timeouts do Google Calendar respondam com sugestão clara ("tente novamente em instantes" em vez de "erro 500")
- Confirmações ambíguas (usuário responde algo diferente de sim/não) tenham fallback educado

### 3. UX — Feedback visual em ações lentas
- Adicionar spinners/skeletons onde falta:
  - Sync manual do Google Calendar
  - Envio de código WhatsApp (já tem `loading`, verificar cobertura)
  - Exclusão de compromissos (evitar cliques duplicados)

### 4. Consistência — Termos financeiros vs conversacionais
Varrer o código atrás de "conversa/chat/mensagem" e trocar por "transação/movimentação" conforme a memory `ui/terminology-transactions-vs-conversations` — exceto onde o contexto é literalmente sobre a mensagem WhatsApp.

## Fora do escopo (fica para próximo bloco)
- Refatorações de arquitetura (dashboard, componentes grandes)
- Novas features
- Otimizações de performance de query

## Detalhes técnicos

- Toasts: usar padrão `toast({ title: t('errors.loadFailed.title'), description: t('errors.loadFailed.desc'), variant: 'destructive' })`
- Chaves i18n novas ficam agrupadas por domínio (`recurring.*`, `commitments.*`, `goals.*`)
- Nenhuma mudança em edge functions nesta rodada — só frontend e locales
- Nenhuma mudança de schema/RLS

## Validação
- Alternar idioma e conferir que os toasts trocam corretamente
- Testar fluxo de recorrência (criar, editar, pausar, deletar) em pt-BR e en-US
- Testar exclusão de compromisso com internet offline (deve mostrar toast traduzido)

Confirma que posso seguir com este escopo?
