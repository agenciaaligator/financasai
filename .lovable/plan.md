

# Plano de Correcao: Eliminar Lacunas do Sistema

## Resumo

Seu sistema tem **5 lacunas concretas** que precisam ser corrigidas antes do lancamento. Nenhuma exige mudancas no Supabase Dashboard.

---

## Lacuna 1: Fallback "plano free" no featureFlags.ts

**Problema**: Quando um usuario nao tem assinatura ativa, o sistema retorna limites de um "plano gratuito" ficticio (50 transacoes, 10 categorias). Como voce NAO tem plano free, isso nao deveria existir -- um usuario sem assinatura nao deveria conseguir criar transacoes.

**Arquivo**: `src/lib/featureFlags.ts` (linhas 55-63)

**Correcao**: Retornar limites ZERO (bloqueio total) em vez de limites "free":
- `maxTransactions: 0`
- `maxCategories: 0`
- `hasWhatsapp: false`

Tambem remover as mensagens "plano Gratuito" das funcoes `canCreateTransaction` e `canCreateCategory` (linhas 100, 132), trocando por mensagem generica tipo "Assine o Premium para usar".

---

## Lacuna 2: check-subscription cria registro com plano "free"

**Problema**: A edge function `check-subscription` (linhas 103-111 e 193-207) busca o plano `free` no banco e cria/atualiza `user_subscriptions` com ele quando o usuario nao tem assinatura no Stripe. Isso e inconsistente -- nao deveria criar nenhum registro de subscription para quem nao assinou.

**Arquivo**: `supabase/functions/check-subscription/index.ts`

**Correcao**: Quando nao ha assinatura ativa no Stripe:
- NAO criar/upsert registro em `user_subscriptions`
- Apenas retornar `{ subscribed: false }` sem tocar no banco
- Remover as duas queries que buscam o plano "free"

---

## Lacuna 3: UpgradeModal exibe planos free e trial do banco

**Problema**: O `UpgradeModal` busca TODOS os planos ativos do banco e renderiza cards para free, trial e premium. Como free e trial estao `is_active: false` no banco, eles nao aparecem AGORA, mas o codigo ainda tem logica para eles (handleStartTrial chamando `activate-trial` que nao existe mais). Se alguem reativar esses planos por engano, o modal quebra.

**Arquivo**: `src/components/UpgradeModal.tsx`

**Correcao**: 
- Remover toda a logica de `handleStartTrial` e `activate-trial`
- Remover referencias a `isFreePlanRole` e `isTrialPlan`
- Simplificar para mostrar apenas o plano Premium com os precos do `pricing.ts` (que ja tem os priceIds corretos por moeda)

---

## Lacuna 4: Inconsistencia no telefone do whatsapp-webhook

**Problema**: A funcao `sendWhatsAppMessage` no `whatsapp-webhook/index.ts` (linha 66) envia o numero `to` diretamente, sem remover o prefixo `+`. Ja no `whatsapp-agent/index.ts` (linha 22), o `+` e removido corretamente. A API do WhatsApp exige o numero SEM `+`.

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts` (linha 51-79)

**Correcao**: Adicionar `const cleanTo = to.startsWith('+') ? to.substring(1) : to;` e usar `cleanTo` no body, identico ao whatsapp-agent.

---

## Lacuna 5: Textos "Gratuito" espalhados pela UI

**Problema**: Varios componentes ainda exibem "Gratuito" como fallback quando nao ha assinatura:
- `useSubscription.ts` retorna "Gratuito" (linhas 90, 127, 141)
- `ProfileSettings.tsx` exibe badge "Gratuito" (linha 921)
- `AdminStats.tsx` mostra contagem "Gratuito" (linha 150)

Como o produto nao tem plano gratuito, esses textos confundem o usuario.

**Arquivos**: `src/hooks/useSubscription.ts`, `src/components/ProfileSettings.tsx`

**Correcao**: Trocar "Gratuito" por "Sem assinatura" ou "Inativo" nos componentes voltados ao usuario. Manter "free" no admin apenas como indicador tecnico de role.

---

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/featureFlags.ts` | Fallback com limites ZERO em vez de limites free |
| `supabase/functions/check-subscription/index.ts` | Remover upsert com plano free quando nao ha assinatura |
| `src/components/UpgradeModal.tsx` | Remover logica de trial/free, simplificar para Premium only |
| `supabase/functions/whatsapp-webhook/index.ts` | Corrigir envio de telefone sem `+` |
| `src/hooks/useSubscription.ts` | Trocar "Gratuito" por "Sem assinatura" |
| `src/components/ProfileSettings.tsx` | Trocar badge "Gratuito" por "Sem assinatura" |

## O que NAO sera alterado (conforme sua instrucao)

- Compartilhamento de conta (backend pronto, UI desativada -- fica assim)
- Agenda de compromissos e lembretes (tabelas existem, crons desativados -- fica assim)
- Nenhuma alteracao no Supabase Dashboard necessaria
- Nenhuma nova dependencia ou custo adicional

## Resultado esperado

Apos essas correcoes, o sistema reflete fielmente a estrategia comercial: **so quem tem assinatura Premium (paga ou via cupom Stripe) consegue usar o produto**. Sem vestígios de plano gratuito em nenhuma camada.
