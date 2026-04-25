## O que está acontecendo

Sua conta admin (`contato@aligator.com.br`) aparece como **"Cancelada"** no painel administrativo na seção "Assinaturas Recentes (Não Ativas)".

### Causa raiz
No banco de dados, sua linha em `user_subscriptions` está com `status = 'cancelled'` (registro criado em 14/10/2025, atualizado em 16/02/2026). A assinatura referenciada no Stripe (`sub_1T1GJC...`) é do ambiente **LIVE**, mas como você é **admin**, o sistema te dá acesso total independentemente do status da assinatura — por isso você não percebeu nenhum bloqueio funcional.

### Isso é um problema?
**Não afeta seu acesso ao app** — admins têm acesso total garantido pela função `has_role(uid, 'admin')`, independentemente da tabela `user_subscriptions`. O `useSubscription` exibe "Admin (Acesso Total)" para você.

**Mas afeta a aparência do painel admin**, que mostra sua própria conta como assinatura cancelada — visualmente confuso e pode preocupar quando você for revisar o painel.

## Plano de ação

Você tem duas opções. Recomendo a **Opção A** (mais limpa).

### Opção A — Remover o registro de assinatura do admin (recomendado)
Como admin não precisa de assinatura paga (acesso é via role), o registro em `user_subscriptions` é redundante e está poluindo o painel.

1. **Migração SQL**: deletar a linha de `user_subscriptions` onde `user_id = 2efec051-aa64-4f31-8c1b-c22ac51d7d7b`.
2. Resultado: sua conta some da seção "Assinaturas Recentes (Não Ativas)" no admin. O hook `useSubscription` continua exibindo "Admin (Acesso Total)" normalmente (não depende dessa tabela quando há role admin).

### Opção B — Filtrar admins/masters do painel de assinaturas
Manter a linha no banco mas esconder admins e masters do componente `SubscriptionsManagement.tsx`.

1. **Edição de código**: em `src/components/admin/SubscriptionsManagement.tsx`, ao montar `subsData`, buscar roles via `user_roles` e filtrar quem tem role `admin` ou está em `master_users`.
2. Vantagem: histórico preservado. Desvantagem: mais código e mantém a confusão se um dia você consultar a tabela direto.

## Detalhes técnicos
- Tabela afetada: `public.user_subscriptions` (1 linha do admin será removida na Opção A).
- Stripe: nenhuma alteração — a assinatura no Stripe permanece como está (já está em estado cancelado lá também, em modo live).
- Acesso preservado: `useAuth` + `useUserRole` + `has_role()` continuam reconhecendo o admin via `user_roles` (você tem `admin` e `premium` lá).
- Painel: `SubscriptionsManagement.tsx` lista somente `user_subscriptions`, então remover a linha resolve definitivamente.

## Confirmação necessária
Confirme qual opção prefere (recomendo **A**) e eu executo a migração.
