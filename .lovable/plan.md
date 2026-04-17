

## Análise do problema relatado

A MARINES disse que **não digitou cartão**, mas:
1. ✅ Validou o WhatsApp (sessão criada)
2. ✅ O agente WhatsApp responde normalmente para ela
3. ❌ Pelo computador mostra "conta inativa"

### Por que isso está acontecendo (diagnóstico):

A validação do WhatsApp dela aconteceu **ANTES** de eu implementar o bloqueio no `whatsapp-webhook` que verifica assinatura ativa. A sessão dela já existe na tabela `whatsapp_sessions` desde antes da correção. Por isso o agente continua respondendo — o webhook do agente (`whatsapp-agent`) só verifica se existe sessão, não se a assinatura está ativa.

### Pontos críticos que ainda estão abertos:

1. **`whatsapp-agent/index.ts`** (o agente que processa transações via WhatsApp) — não verifica assinatura ativa. Qualquer usuário com sessão antiga continua usando o sistema sem pagar.
2. **Sessões órfãs já criadas** (caso da MARINES) — precisam ser invalidadas até pagamento.
3. **Mensagem inicial no WhatsApp** — quando ela manda "oi", o agente trata como usuário válido porque a sessão existe.

## Plano — Bloqueio definitivo em TODAS as camadas

### 1. `whatsapp-agent/index.ts` — Verificar assinatura a cada mensagem
No início do handler, depois de identificar a sessão do usuário:
- Buscar `user_subscriptions.status` do `user_id` da sessão
- Se não for `active`/`trialing` E não for master/admin → responder:
  > "Olá! Sua conta está sem assinatura ativa no momento. Para continuar usando a Dona Wilma, finalize seu pagamento em https://donawilma.lovable.app/escolher-plano. Após confirmar, é só me mandar uma mensagem novamente! 💛"
- **Não processar transação, não chamar IA, não gastar créditos.**
- Isso bloqueia o caso da MARINES imediatamente.

### 2. Limpar sessão órfã da MARINES
Migration única (DELETE) na `whatsapp_sessions` do `user_id` `772f5a68-72e2-467b-89d4-ea33396dc2f6`. Quando ela pagar, ela revalida com um novo claim code (fluxo já implementado).

### 3. Reforço no `whatsapp-webhook` (claim code) — já implementado ✅
Já bloqueia criação de sessão sem assinatura ativa.

### 4. Reforço no `Welcome.tsx` — já implementado ✅
Já redireciona para `/escolher-plano` se sem assinatura.

### 5. Garantia adicional: `useSubscriptionGuard` no Dashboard
Verificar se o dashboard (`Index.tsx` ou rota raiz logada) usa o guard. Se não usar, adicionar — qualquer rota logada deve verificar.

## Resumo das camadas de defesa (depois desta correção)

| Camada | Bloqueio sem pagamento |
|--------|------------------------|
| Frontend `/boas-vindas` | ✅ Redireciona para checkout |
| Frontend Dashboard | ✅ `useSubscriptionGuard` redireciona |
| Frontend `/payment-success` | ✅ Fallback "pagamento não localizado" |
| WhatsApp claim code (validação) | ✅ Webhook recusa criar sessão |
| **WhatsApp agent (uso diário)** | 🔴 **Falta — vou implementar** |
| Sessão órfã da MARINES | 🔴 **Falta — vou limpar** |

## Posso testar com um novo usuário?

**Sim, com segurança, depois desta correção.** O fluxo definitivo será:

1. Cria conta → email de confirmação chega
2. Confirma email → cai em `/escolher-plano` (se não pagou) ou `/boas-vindas` (se pagou)
3. Sem cartão digitado = **impossível** validar WhatsApp (webhook recusa)
4. Sem cartão digitado = **impossível** o agente responder (agent recusa)
5. Sem cartão digitado = **impossível** acessar dashboard (guard recusa)

## Arquivos afetados

- `supabase/functions/whatsapp-agent/index.ts` — adicionar verificação de assinatura no início
- Migration (DELETE) — remover sessão órfã da MARINES
- `src/pages/Index.tsx` (verificar se usa guard, ajustar se necessário)

## Antes de implementar — confirmar

Vou também verificar se a MARINES tem sessão na `whatsapp_sessions` para confirmar o diagnóstico antes de deletar. Se você aprovar o plano, faço isso na primeira ação.

