
# Ajustes para MVP de Producao - Fluxo Claro e Funcional

## Resumo

Simplificar o fluxo de onboarding para: Landing Page -> Checkout Stripe -> Payment Success -> Onboarding (WhatsApp) -> Dashboard. Eliminar duplicidade de telas de planos, remover referencias a features removidas (Google Calendar, equipe, lembretes), e padronizar mensagens de erro.

## O que sera alterado

### 1. Unificar telas de plano (eliminar duplicidade)

**Problema:** Existem duas telas separadas (`/plans` com `PlansSection` e `/choose-plan` com `ChoosePlan`). O botao da landing page leva a `PlansSection`, que por sua vez navega para `/choose-plan`. Dois cliques desnecessarios.

**Solucao:**
- Remover a rota `/plans` e a pagina `src/pages/Plans.tsx`
- Na `PlansSection` (usada na landing page), trocar o botao "Comecar agora" para chamar diretamente o `create-checkout` com o `priceId` correto (igual ao `ChoosePlan`), em vez de navegar para `/choose-plan`
- Manter `/choose-plan` como rota direta para quem acessar via URL (sem mudancas)
- Na landing page, o botao "Ver planos" ja faz scroll para `#planos` - isso continua

### 2. Atualizar lista de features (remover items do MVP removido)

Nos dois locais onde features sao listadas (`PlansSection.tsx` e `ChoosePlan.tsx`):

**Remover:**
- "Google Calendar"
- "Multi-usuario"
- "Relatorios com IA"

**Manter:**
- Transacoes ilimitadas
- Categorias ilimitadas
- WhatsApp integrado
- Suporte prioritario

**Adicionar:**
- Classificacao automatica por IA
- Consultas financeiras por WhatsApp

### 3. Atualizar Landing Page (remover blocos de features removidas)

No `src/pages/Index.tsx`, remover os FeatureBlocks que promovem funcionalidades fora do MVP:

- **Remover** Bloco 2: "Gestao de Compromissos" (agenda)
- **Remover** Bloco 5: "Compartilhe sua conta" (multiusuario)
- **Remover** Bloco 7: "Lembretes Diarios" (notificacoes)
- **Remover** Bloco 8: "Integracao com Google Agenda" (Google Calendar)

**Manter:** Bloco 1 (Financeiro), Bloco 3 (Registros), Bloco 4 (Painel), Bloco 6 (Categorias)

### 4. Atualizar FAQ

No `src/components/FAQSection.tsx`:
- Remover pergunta sobre Google Calendar
- Atualizar pergunta sobre WhatsApp (remover "lembretes e notificacoes", focar em registro de transacoes)

### 5. Atualizar Welcome/Onboarding

No `src/pages/Welcome.tsx`:
- Remover dica "Reuniao amanha as 14h" (agenda removida)
- Atualizar descricao do card WhatsApp: remover "Receba lembretes", focar em "Registre transacoes pelo WhatsApp"
- Manter fluxo existente (phone -> code -> connected -> dashboard)
- Nao bloquear acesso ao dashboard

### 6. Padronizar mensagens de erro

No `src/components/PlansSection.tsx` (apos adicionar checkout direto) e `src/pages/ChoosePlan.tsx`:
- Mensagem de erro padrao: "Nao foi possivel completar a acao. Tente novamente."
- Remover mensagens tecnicas como `error.message` da exibicao ao usuario

### 7. Remover rota `/plans` do App.tsx

- Remover import de `Plans`
- Remover `<Route path="/plans" ...>`

### 8. Limpeza do `src/pages/Index.tsx`

- Remover texto da hero que menciona "compromissos" (focar em financas)
- Remover icons nao utilizados (Bell, RefreshCw, Users, Clock)

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/pages/Plans.tsx` | Deletar |
| `src/App.tsx` | Remover rota `/plans` e import |
| `src/components/PlansSection.tsx` | Adicionar checkout direto, atualizar features |
| `src/pages/ChoosePlan.tsx` | Atualizar features, padronizar erros |
| `src/pages/Index.tsx` | Remover 4 FeatureBlocks, limpar hero text e icons |
| `src/components/FAQSection.tsx` | Remover FAQ do GCal, atualizar FAQ do WhatsApp |
| `src/pages/Welcome.tsx` | Remover dica de agenda, atualizar descricao |

## O que NAO sera alterado

- Edge functions (create-checkout, stripe-webhook, check-subscription, whatsapp-*)
- Banco de dados
- Fluxo de autenticacao
- PaymentSuccess (ja funciona corretamente)
- Dashboard
- useSubscriptionStatus (ja e reativo, sem background)
- Stripe (allow_promotion_codes ja esta true)

## Ordem de execucao

1. Deletar `src/pages/Plans.tsx` e remover rota do `App.tsx`
2. Atualizar `PlansSection.tsx` com checkout direto
3. Atualizar features em `PlansSection.tsx` e `ChoosePlan.tsx`
4. Limpar landing page (`Index.tsx`) - remover blocos e texto
5. Atualizar `FAQSection.tsx`
6. Atualizar `Welcome.tsx`
