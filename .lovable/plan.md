# Corrigir lógica de intent do agente WhatsApp para agendamentos

## Problema identificado

Ao enviar **"agendar dentista amanhã as 11h"**, o agente respondeu com a lista dos próximos 5 compromissos em vez de criar o agendamento.

**Causa raiz** (em `supabase/functions/whatsapp-agent/index.ts`, linhas 2138–2168):

1. Existe um "HARD MATCH" que dispara listagem sempre que a mensagem contém `compromiss*` + qualquer uma das palavras: `meu, ver, mostrar, quais, hoje, amanha, semana, listar, proximos`. A palavra **"amanha"** sozinha já força listagem, mesmo quando o verbo é "agendar".
2. Logo abaixo, o regex `isList` repete o mesmo erro: a presença de "amanha", "hoje", "semana", "tenho", etc., classifica como listagem mesmo em mensagens claramente de criação ("agendar...", "marcar...").

Resultado: qualquer frase de criação que mencione um dia relativo cai em listagem.

## O que vou corrigir

### 1. Priorizar verbos de criação sobre palavras de tempo
Antes de qualquer regra de listagem, detectar verbos/intenção de **criar** compromisso e roteá-los para `addCommitment`:

- Verbos de criação: `agendar, marcar, criar, adicionar, registrar, anotar, colocar, bota, põe, agende, marque`
- Sinais de novo evento: presença de horário (`11h`, `às 14:00`, `9 da manhã`) **ou** dia específico (`segunda`, `dia 15`, `amanhã`, `hoje`) combinado com um verbo de criação ou um substantivo de evento + valor de tempo.

Se houver verbo de criação → sempre `addCommitment`, mesmo que a frase contenha "hoje"/"amanhã".

### 2. Restringir o "HARD MATCH" de listagem
A listagem só dispara quando a frase é claramente uma consulta:

- Padrões de pergunta: começa com `quais`, `quando`, `tenho algum`, `o que tenho`, `me mostra`, `me lista`, `mostrar`, `listar`, `ver meus`, `meus próximos`, `próximos compromissos`, `compromissos de hoje/amanhã/da semana`.
- E **não** contém verbo de criação.

### 3. Garantir checagem de conflito (já existe, validar fluxo)
A função `addCommitment` (linha 4245) já consulta conflitos numa janela de ±1h e responde com a mensagem `❌ Não posso agendar "X" às HH:MM — Você já tem: ...` oferecendo opções (manter, remarcar, cancelar). Vou confirmar que o caminho corrigido entra nesse fluxo e que a resposta de conflito está clara e curta.

### 4. Ajustar mensagem quando o usuário pede a lista
Manter o comportamento atual (listar próximos compromissos), mas garantir que **"compromissos de hoje"** filtre de fato pelo dia de hoje (e não retorne os próximos 5 quaisquer). Hoje a `listCommitments` retorna 5 fixos; vou aceitar parâmetro de janela (`hoje`, `amanhã`, `semana`, default = próximos 5) e filtrar a query por `scheduled_at` no intervalo correspondente em America/Sao_Paulo.

## Arquivos afetados

- `supabase/functions/whatsapp-agent/index.ts` — única alteração:
  - Bloco de roteamento de intent de agenda (≈ linhas 2137–2170): nova ordem de prioridade (criação > listagem) e regex mais estrito para listagem.
  - `listCommitments`: aceitar janela temporal extraída da mensagem.

Nenhuma mudança em banco, edge functions adicionais, ou frontend.

## Casos de teste manuais (após implementar)

```text
agendar dentista amanhã às 11h     → cria (ou avisa conflito se houver)
marcar reunião hoje 15h            → cria
remarcar dentista amanhã 14h       → fluxo de edição
quais meus compromissos hoje?      → lista só de hoje
meus próximos compromissos         → lista próximos 5
tenho algo amanhã?                 → lista de amanhã
agendar consulta dia 15 às 9h      → cria
```

## Impacto

- Não afeta transações financeiras, login, Stripe, Google Calendar nem outras intents.
- Nenhum custo novo no Supabase: a checagem de conflito já existia, só estava sendo pulada pelo roteamento incorreto.
- Sem alteração de schema, sem cron, sem nova função.
