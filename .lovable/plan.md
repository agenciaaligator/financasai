## Objetivo

Corrigir 4 problemas relacionados ao agendamento de compromissos e atualizar a landing page com a integração Google Agenda, sem afetar nenhuma outra funcionalidade do sistema.

---

## 1. Detecção de conflito de horário no painel (desktop)

**Problema:** Ao criar um compromisso pelo `CommitmentForm` (botão "Novo" na aba Agenda), o sistema não verifica se já existe outro compromisso no mesmo horário — diferente do agente do WhatsApp, que já faz essa checagem.

**Correção em `src/components/dashboard/CommitmentForm.tsx`:**
- Antes de chamar `google-calendar-event`, consultar a tabela `commitments` (do usuário, mesmo dia/janela ±duração) para detectar sobreposição.
- Se houver conflito: abrir um `AlertDialog` mostrando o(s) compromisso(s) existente(s) e oferecer 3 opções:
  1. **Manter os dois** (agendar mesmo assim)
  2. **Cancelar**
  3. **Escolher outro horário** (volta ao formulário)
- Se não houver conflito: seguir o fluxo atual.

> Nota: a lógica de conflito do agente WhatsApp (linhas ~4567 e ~6151 de `whatsapp-agent/index.ts`) já funciona e **não será tocada**.

---

## 2. Sincronização de eventos criados eventualmente (admin/painel) com o Google

**Resposta à dúvida:** Hoje, todo compromisso criado pelo painel passa pela edge function `google-calendar-event`, que **já cria o evento no Google na hora**. A função `google-calendar-sync` é uma sincronização **bidirecional sob demanda** (botão "Sincronizar agora") que importa do Google → app.

**Comportamento atual (correto, sem mudança necessária):**
- Painel cria compromisso → vai direto pro Google.
- WhatsApp cria → vai direto pro Google (via `syncWithGoogleCalendar` no agente).
- Botão "Sincronizar agora" → traz os 90 próximos dias do Google pra dentro do app (caso o usuário tenha criado algo direto no Google).

Vou apenas **deixar isso explícito na UI** com um pequeno texto informativo na aba Agenda: "Compromissos criados aqui ou pelo WhatsApp aparecem automaticamente no Google. Use 'Sincronizar agora' para puxar eventos criados direto no Google."

---

## 3. Treinamento do agente WhatsApp para agendamento

**Resposta à dúvida:** O agente já tem fluxo completo de agendamento (estados `awaiting_commitment_time`, `awaiting_commitment_details`, `awaiting_commitment_confirmation`, `awaiting_commitment_resolution`, `awaiting_commitment_edit_*`, `awaiting_commitment_cancel_selection`, `awaiting_work_hour_override`), com:
- NLP para identificar intent de agendamento
- Detecção de conflito + opções de resolução
- Confirmação humanizada por categoria (consulta, reunião, pagamento, etc.)
- Sincronização com Google na confirmação
- Edição e cancelamento de compromissos existentes

**Não vou alterar essa lógica** — apenas ajustar as mensagens de lembrete (item 4).

---

## 4. Mensagens de lembrete padronizadas (WhatsApp e Google)

**Problema:** As confirmações dizem genericamente "você receberá lembretes" / "lembretes automáticos", sem informar quando.

**Correções em `supabase/functions/whatsapp-agent/index.ts`:**

- **Linha ~5782** (mensagem de confirmação compacta — antes do CONFIRMAR):
  - Trocar `🔔 Você receberá lembretes automáticos` por:
    `🔔 *Lembretes:* 1 dia e 1 hora antes (WhatsApp + Google Agenda)`
- **Linhas ~5991-5995** (sucesso após confirmação):
  - Trocar os bullets atuais ("WhatsApp: 24h, 2h e 1h antes" / "Google: 24h, 2h, 1h e 30min") por um padrão único:
    ```
    ⏰ *Lembretes:*
    • 📱 WhatsApp: 1 dia e 1 hora antes
    • 📅 Google Agenda: 1 dia e 1 hora antes
    ```
- **Linha ~4934** (atalho "Compromisso agendado"):
  - Trocar `Você receberá um lembrete antes do horário.` por `🔔 Lembretes: 1 dia e 1 hora antes (WhatsApp e Google Agenda).`

**Padronizar os tempos efetivos enviados:**
- No agente, alinhar `reminders_minutes` enviados ao Google em `[1440, 60]` (1 dia + 1 hora) — hoje em alguns pontos é `[1440, 30]` ou `[1440, 120, 60]`. Padroniza para o que a mensagem promete.
- No `CommitmentForm.tsx` o default já é 1440 + 30; ajustar para **1440 + 60** e atualizar o texto auxiliar para: "Lembretes pelo Google: 1 dia e 1 hora antes (push + e-mail)."
- Ajustar também o cron de WhatsApp (`check-goal-alerts`/job de lembretes) só **se** houver schedule de 24h/2h/1h hoje — vou manter os jobs como estão e apenas ajustar copy se a janela atual já cobrir 1d+1h. Caso o job esteja disparando 3 lembretes, reduzir para 2 (1440 e 60 minutos antes) para casar com a mensagem.

---

## 5. Landing page — seção Google Agenda

Adicionar conteúdo sobre agendamento de compromissos integrado ao Google Agenda em:

- **`src/components/FeatureBlock.tsx` (ou novo bloco)**: card dedicado:
  - Ícone Calendar
  - Título: "Compromissos no seu Google Agenda"
  - Texto: "Marque consultas, reuniões e pagamentos pelo WhatsApp ou pelo painel. Tudo aparece automaticamente no seu Google Agenda, com lembretes 1 dia e 1 hora antes."
- **`src/components/InteractionExamplesSection.tsx`**: adicionar 1 exemplo de conversa com a Dona Wilma:
  - Usuário: "Marca consulta com dentista quarta às 15h"
  - Dona Wilma: confirma com horário, lembretes e cria no Google.
- **`src/components/FAQSection.tsx`**: adicionar 2 perguntas:
  - "Como funciona a integração com o Google Agenda?"
  - "Posso receber lembretes pelo WhatsApp e pelo Google ao mesmo tempo?"
- Adicionar traduções correspondentes em `src/locales/pt-BR.json`, `pt-PT.json`, `en-US.json`, `es-ES.json`, `it-IT.json` (chaves novas; nenhuma chave existente removida).

---

## 6. Garantia de não-regressão

- Nenhuma alteração em: `useGoogleCalendar.ts`, `useCommitments.ts`, `google-calendar-auth`, `google-calendar-callback`, `google-calendar-sync`, fluxo de OAuth, RLS, cron jobs, fluxo de transações, OCR, recurring transactions, autenticação WhatsApp, assinatura Stripe.
- Mudanças isoladas: detecção de conflito no `CommitmentForm`, copy de lembretes em 3 trechos do `whatsapp-agent`, copy padrão de minutos no `CommitmentForm`, novos blocos/textos na landing.

---

## Resumo técnico (ordem de execução)

```text
1. CommitmentForm.tsx     → checagem de conflito + dialog + default 60min
2. whatsapp-agent/index.ts → 3 trechos de copy + reminders_minutes [1440,60]
3. AgendaPage.tsx         → texto curto explicando sincronização
4. Landing                → FeatureBlock + InteractionExamples + FAQ
5. Locales                → novas chaves nos 5 idiomas
```
