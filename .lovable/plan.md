
# Plano de Refinamento: Dashboard, i18n, Stripe e Onboarding

## Visao Geral

Quatro frentes de trabalho, organizadas por prioridade e dependencia.

---

## 1. Refinar visual do dashboard

### Problemas identificados

- **Moeda hardcoded "R$"**: `SummaryCards.tsx`, `FilteredSummaryCards.tsx`, `FinancialChart.tsx` usam "R$" fixo e `toLocaleString('pt-BR')`. Isso nao faz sentido para usuarios em outros idiomas/moedas.
- **Nome do mes hardcoded em pt-BR**: `SummaryCards.tsx` linha 26 usa `ptBR` do date-fns fixo para formatar o mes.
- **Textos hardcoded no dashboard**:
  - `BalanceAlert.tsx`: "Atencao! Seu saldo esta negativo" e subtexto
  - `FilteredSummaryCards.tsx`: "Saldo do Periodo", "Receitas", "Despesas", "Top Categorias", "transacoes", "Total recebido", "Total gasto", "Sem categorias"
  - `WhatsAppPage.tsx`: ~40 textos hardcoded (labels, toasts, comandos, etc.)
  - `AppSidebar.tsx`: "Sua assessora pessoal" hardcoded (linhas 138, 250)
- **Welcome.tsx**: Todos os textos hardcoded (~30 strings)

### Alteracoes

| Arquivo | O que fazer |
|---------|-------------|
| `SummaryCards.tsx` | Usar locale dinamico do i18n para formatar data do mes; usar t() nos textos restantes |
| `FilteredSummaryCards.tsx` | Migrar todos os textos para t() |
| `BalanceAlert.tsx` | Migrar textos para t() |
| `FinancialChart.tsx` | Ja usa t() -- OK |
| `AppSidebar.tsx` | Migrar "Sua assessora pessoal" para t() |

**Nota sobre moeda**: Manter "R$" por enquanto pois o produto e focado no mercado brasileiro. A formatacao multi-moeda sera tratada no item 3 (Stripe multi-moeda) como uma evolucao futura.

---

## 2. Finalizar internacionalizacao

### Componentes ainda com textos hardcoded

| Componente | Textos hardcoded |
|------------|------------------|
| `BalanceAlert.tsx` | 2 strings |
| `FilteredSummaryCards.tsx` | 8 strings |
| `WhatsAppPage.tsx` | ~40 strings (labels, toasts, comandos, dicas) |
| `Welcome.tsx` | ~30 strings (onboarding completo) |
| `ProfileSettings.tsx` | ~50 strings (labels, toasts, status) |
| `AppSidebar.tsx` | 1 string ("Sua assessora pessoal") |
| `SummaryCards.tsx` | 1 toast description hardcoded |

### Acao

- Adicionar chaves novas nos 5 arquivos de locale (`pt-BR`, `pt-PT`, `en-US`, `es-ES`, `it-IT`)
- Substituir todos os textos hardcoded por `t('chave')`
- Organizar chaves em namespaces: `dashboard.*`, `whatsapp.*`, `welcome.*`, `profile.*`

### Novas chaves a criar (estimativa)

```text
dashboard.balanceAlert.title
dashboard.balanceAlert.description
dashboard.filtered.periodBalance
dashboard.filtered.totalReceived
dashboard.filtered.totalSpent
dashboard.filtered.topCategories
dashboard.filtered.noCategories
dashboard.filtered.transactions

whatsapp.setupIn2Min
whatsapp.afterConnect
whatsapp.addByVoice
whatsapp.sendReceipts
whatsapp.checkBalance
whatsapp.phoneLabel
whatsapp.phonePlaceholder
whatsapp.phoneFormat
whatsapp.codeLabel
whatsapp.codePlaceholder
whatsapp.codeHint
whatsapp.sending
whatsapp.verifyCode
whatsapp.number
whatsapp.sendHelpHint
whatsapp.cmdAdd (lista de comandos)
whatsapp.cmdOcr
whatsapp.cmdEdit
whatsapp.cmdQuery
... (detalhados na implementacao)

welcome.title
welcome.subtitle
welcome.connectWhatsApp
welcome.connectDesc
welcome.phoneLabel
welcome.phoneHint
welcome.sendCode
welcome.sending
welcome.codeLabel
welcome.codePlaceholder
welcome.codeHint
welcome.back
welcome.verify
welcome.verifying
welcome.connected
welcome.number
welcome.readyToUse
welcome.tips.title
welcome.tips (4 dicas)
welcome.goToSystem
welcome.skipForNow

sidebar.subtitle (Sua assessora pessoal)
```

---

## 3. Ajustar Stripe multi-moeda

### Situacao atual

- `pricing.ts` tem precos fixos em BRL (R$ 24,90/mes e R$ 239,04/ano)
- `formatPrice()` retorna sempre "R$" com formato brasileiro
- `PlansSection.tsx` ja usa `t()` para textos, mas o preco e formatado com `formatPrice()` que e fixo em BRL
- O Stripe aceita apenas um `priceId` por checkout, entao multi-moeda real exigiria criar prices separados no Stripe para cada moeda

### Recomendacao para MVP

**NAO implementar multi-moeda real agora.** Razoes:
- Exige criar prices separados no Stripe para cada moeda (USD, EUR, etc.)
- Exige logica de selecao de price baseado no locale do usuario
- Complexidade alta para beneficio baixo no MVP

### Acao minima viavel

- Extrair o simbolo de moeda e formatacao para uma funcao utilitaria que respeita o locale
- No `pricing.ts`, adicionar um helper `formatCurrency(amount, locale)` que usa `Intl.NumberFormat`
- Atualizar `formatPrice()` para aceitar locale opcional
- Resultado: mesmo preco em BRL, mas formatado corretamente para cada locale (ex: "BRL 24,90" vs "R$ 24.90")

| Arquivo | Alteracao |
|---------|-----------|
| `src/config/pricing.ts` | Atualizar `formatPrice()` para usar `Intl.NumberFormat` com locale |
| `src/components/PlansSection.tsx` | Passar locale atual para formatacao |
| `src/components/dashboard/SummaryCards.tsx` | Usar formatacao baseada em locale |
| `src/components/dashboard/FilteredSummaryCards.tsx` | Usar formatacao baseada em locale |

---

## 4. Organizar fluxo final de onboarding

### Fluxo atual

```text
Stripe checkout -> stripe-webhook cria usuario -> 
email de reset de senha -> usuario faz login -> 
Index.tsx verifica whatsapp_sessions -> 
redireciona para /boas-vindas -> Welcome.tsx
```

### Problemas

- `Welcome.tsx` tem textos 100% hardcoded em portugues
- Nao usa `useTranslation()` nem respeita o idioma selecionado
- Textos de toast e validacao hardcoded

### Acao

- Adicionar `useTranslation()` ao `Welcome.tsx`
- Migrar todos os textos para chaves i18n
- Manter a logica de fluxo intacta (nao alterar redirecionamentos nem verificacoes)
- Adicionar `LanguageFlagSelector` ao header do Welcome.tsx para consistencia

---

## Ordem de implementacao

1. **Locale files**: Adicionar todas as novas chaves nos 5 arquivos de idioma
2. **Componentes do dashboard**: BalanceAlert, FilteredSummaryCards, AppSidebar
3. **WhatsAppPage.tsx**: Migrar ~40 strings
4. **Welcome.tsx**: Migrar ~30 strings + adicionar seletor de idioma
5. **ProfileSettings.tsx**: Migrar ~50 strings
6. **Pricing/formatacao**: Atualizar formatPrice() e aplicar nos componentes

## Arquivos modificados (total)

| Arquivo | Tipo |
|---------|------|
| `src/locales/pt-BR.json` | Novas chaves |
| `src/locales/pt-PT.json` | Novas chaves |
| `src/locales/en-US.json` | Novas chaves |
| `src/locales/es-ES.json` | Novas chaves |
| `src/locales/it-IT.json` | Novas chaves |
| `src/components/dashboard/BalanceAlert.tsx` | i18n |
| `src/components/dashboard/FilteredSummaryCards.tsx` | i18n |
| `src/components/dashboard/SummaryCards.tsx` | i18n + locale format |
| `src/components/dashboard/WhatsAppPage.tsx` | i18n |
| `src/components/AppSidebar.tsx` | i18n |
| `src/components/ProfileSettings.tsx` | i18n |
| `src/pages/Welcome.tsx` | i18n + language selector |
| `src/config/pricing.ts` | formatPrice com locale |
| `src/components/PlansSection.tsx` | Usar locale na formatacao |

## O que NAO muda

- Logica do Stripe (priceIds, checkout, webhooks)
- Valores de precos (R$ 24,90/mes e R$ 239,04/ano)
- Fluxo de onboarding (redirecionamentos, verificacoes)
- Estrutura de rotas
- RLS/banco de dados
