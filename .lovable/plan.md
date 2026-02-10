

# Preparacao para Lancamento MVP - Limpeza e Simplificacao

## Resumo

Remover funcionalidades de multiusuario e upgrade do frontend, simplificar o card "Meu Plano" para "Seu Acesso", melhorar visual do dashboard, e expandir cobertura i18n. A logica de sugestao de conta fixa no WhatsApp ja existe parcialmente no agente -- sera complementada. Nenhuma alteracao de backend, banco ou Stripe.

---

## 1. Remover "Ver apenas minhas transacoes" e logica multiusuario visivel

**Arquivos:** `src/components/dashboard/DashboardContent.tsx`, `src/components/dashboard/DashboardHeader.tsx`

Alteracoes em `DashboardContent.tsx`:
- Remover os dois blocos de toggle "Ver apenas minhas" (linhas 371-385 e 458-472)
- Remover estado `showOnlyMine` e seus efeitos de localStorage (linhas 144-170)
- Remover busca de `orgMembers` (linhas 83-109)
- Remover import de `useOrganizationPermissions`, `Switch`, `Label`
- Simplificar `visibleTransactions` para ser igual a `transactions` (sem filtro multiusuario)
- Remover `canViewOthers`, `organization_id`, `role` do destructuring
- Remover variavel `orgTransactions` e `myTransactions` (linhas 443-445)
- Remover prop `orgMembers` do `TransactionFilters`

Alteracoes em `DashboardHeader.tsx`:
- Remover banner de backfill inteiro (linhas 17-63 e 84-120)
- Remover badge de role (owner/admin/membro) (linhas 134-149)
- Remover import de `useOrganizationPermissions`
- Manter apenas email do usuario, LanguageSelector e botao Sair

**Arquivo:** `src/components/TransactionList.tsx`
- Remover badge de `profiles` (usuario) das transacoes (linhas 151-158)
- Manter badges de categoria e fonte (WhatsApp/Manual)

**Arquivo:** `src/components/TransactionFilters.tsx`
- Remover filtro "Responsavel" se existir
- Remover prop `orgMembers`

---

## 2. Remover todas as referencias a Upgrade

**Arquivos afetados:**

| Arquivo | O que remover |
|---------|--------------|
| `SummaryCards.tsx` | Botao "Upgrade", import/uso de `UpgradeModal`, estados `showUpgradeModal` |
| `LimitWarning.tsx` | Botao "Fazer Upgrade" e `UpgradeModal` -- simplificar para apenas mostrar aviso informativo |
| `ProfileSettings.tsx` | Botao "Fazer Upgrade para Premium" e `UpgradeModal` |
| `TransactionForm.tsx` | `UpgradeModal` -- manter o `toast` de limite mas remover o modal de upgrade |
| `CategoryManager.tsx` | `UpgradeModal` -- manter o `toast` de limite mas remover o modal de upgrade |

O componente `UpgradeModal.tsx` pode ser mantido no codigo (nao precisa deletar), mas nao sera mais importado em nenhum lugar.

---

## 3. Simplificar card "Meu Plano" para "Seu Acesso"

**Arquivo:** `src/components/dashboard/SummaryCards.tsx`

Transformar o 4o card:
- Titulo: "Seu Acesso" (via i18n key `summary.yourAccess`)
- Exibir apenas:
  - Badge verde "Ativo" (sempre, ja que so tem 1 plano pago)
  - Texto "Acesso completo" 
- Remover progress bars de transacoes/categorias
- Remover botao Upgrade
- Manter botao "Gerenciar assinatura" (Stripe Customer Portal) para usuarios premium
- Remover imports de `Progress`, `useFeatureLimits`, `UpgradeModal`, `Sparkles`
- Simplificar grid para 3 colunas em desktop (`md:grid-cols-3`) -- ou manter 4 se o card "Seu Acesso" for mantido

---

## 4. Melhorias visuais no dashboard

### 4.1 Cards de resumo
- Ja estao com `border-0` e `shadow-card` -- manter
- Valores ja estao `text-2xl font-bold` -- manter

### 4.2 Grafico financeiro (ja melhorado anteriormente)
- Ja tem altura 280px, cores `#059669`/`#dc2626`, tooltips -- manter como esta

### 4.3 Lista de transacoes
- Ja tem icones por tipo (`TrendingUp`/`TrendingDown`), border colorido, valores grandes -- manter
- Remover badge de usuario (item 1 acima)

---

## 5. WhatsApp -- sugestao de conta fixa

**Arquivo:** `supabase/functions/whatsapp-agent/index.ts`

O agente ja tem logica para criar contas fixas via comandos explicitos ("conta fixa 150 internet dia 10"). O pedido e adicionar deteccao de palavras-chave em transacoes normais.

Na funcao que processa transacoes normais (quando o usuario diz "paguei 200 conta de luz"):
- Apos salvar a transacao, verificar se o titulo contem palavras-chave: `luz`, `agua`, `aluguel`, `internet`, `netflix`, `spotify`, `assinatura`, `condominio`, `seguro`, `plano`
- Se detectar, adicionar ao final da resposta de confirmacao:
  ```
  💡 Essa conta parece se repetir todo mes. Quer salvar como conta fixa?
  Responda SIM para cadastrar automaticamente.
  ```
- Salvar no `sessionData` um estado `awaiting_recurring_confirmation` com os dados da transacao
- Quando o usuario responder "sim", criar a conta fixa
- Quando responder "nao" ou qualquer outra coisa, voltar ao estado normal

Esta e a UNICA alteracao de edge function neste plano.

---

## 6. Internacionalizacao -- expandir cobertura

### Componentes com strings hardcoded a corrigir:

| Componente | Strings hardcoded |
|-----------|-------------------|
| `DashboardHeader.tsx` | "Dashboard Financeiro", "Gerencie suas financas...", "Sair" |
| `DashboardContent.tsx` | "Grafico Financeiro", "Ultimas Transacoes", "Todas as Transacoes", "Nova Categoria", "Cancelar" |
| `TransactionList.tsx` | "Nenhuma transacao encontrada", "Voce tem filtros ativos", "Mostrando X-Y de Z transacoes", etc |
| `TransactionFilters.tsx` | Todos os labels de filtro |
| `LimitWarning.tsx` | Textos de aviso de limite |
| `CategoryManager.tsx` | Textos de formulario |

Todos serao substituidos por chamadas `t('key')` usando chaves ja existentes ou novas nos arquivos de locale.

### Locale files
- Expandir `pt-BR.json`, `en-US.json`, `es-ES.json`, `it-IT.json`, `pt-PT.json` com as chaves faltantes
- Adicionar nova secao `summary.yourAccess` em todos os locales
- Remover chave `summary.upgrade` (nao mais usada)

### Landing page
- A maioria dos textos da landing page (`Index.tsx`) ainda esta hardcoded
- Aplicar `useTranslation` e criar chaves em `landing.*` nos 5 arquivos de locale
- Cobrir: hero, secao de features, CTAs, nav links, footer

---

## 7. Limpeza adicional

- Remover `DashboardHeader.tsx`: import de `useOrganizationPermissions` e toda a logica de backfill
- Remover `TransactionFilters.tsx`: campo `responsible` do state type e da UI
- Remover referencia a `orgMembers` de `DashboardContent.tsx`

---

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| `src/components/dashboard/DashboardContent.tsx` | Remover toggle, multiusuario, orgMembers |
| `src/components/dashboard/DashboardHeader.tsx` | Remover backfill, role badge |
| `src/components/dashboard/SummaryCards.tsx` | Simplificar para "Seu Acesso", remover upgrade |
| `src/components/dashboard/LimitWarning.tsx` | Remover botao upgrade |
| `src/components/TransactionList.tsx` | Remover badge de usuario, i18n |
| `src/components/TransactionFilters.tsx` | Remover filtro responsavel, i18n |
| `src/components/TransactionForm.tsx` | Remover UpgradeModal |
| `src/components/CategoryManager.tsx` | Remover UpgradeModal |
| `src/components/ProfileSettings.tsx` | Remover botao upgrade |
| `src/pages/Index.tsx` | i18n na landing page |
| `supabase/functions/whatsapp-agent/index.ts` | Sugestao de conta fixa |
| `src/locales/pt-BR.json` | Expandir chaves, landing |
| `src/locales/en-US.json` | Expandir chaves, landing |
| `src/locales/es-ES.json` | Expandir chaves, landing |
| `src/locales/it-IT.json` | Expandir chaves, landing |
| `src/locales/pt-PT.json` | Expandir chaves, landing |

## O que NAO sera alterado

- Banco de dados
- Stripe / checkout / webhook
- Autenticacao
- Edge functions (exceto whatsapp-agent para sugestao)
- Hooks de negocio (useSubscription, useFeatureLimits ficam no codigo, apenas nao exibidos)
- Menu lateral (ja esta correto com Lancamentos + Contas Fixas)

## Ordem de execucao

1. Remover toggle e multiusuario do DashboardContent e DashboardHeader
2. Remover upgrade de SummaryCards, LimitWarning, ProfileSettings, TransactionForm, CategoryManager
3. Simplificar card "Seu Acesso"
4. Remover badge de usuario e filtro responsavel
5. Expandir locale files e aplicar i18n nos componentes com strings hardcoded
6. Aplicar i18n na landing page
7. Atualizar whatsapp-agent com sugestao de conta fixa

