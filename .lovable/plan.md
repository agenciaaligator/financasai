
# Mapeamento automatico de price_id por idioma

## Resumo

Substituir o sistema atual de priceId unico por um mapeamento automatico baseado no idioma selecionado pelo usuario. Sem seletor de moeda -- a moeda e determinada pelo idioma. O `create-checkout` ja aceita qualquer `priceId`, entao nao precisa de alteracao no backend.

## Mapeamento idioma -> moeda

| Idioma | Moeda | Mensal | Anual |
|--------|-------|--------|-------|
| pt-BR | BRL | price_1T0RbZJH1fRNsXz1rT6ThCQb | price_1T0TJPJH1fRNsXz1UhcqKorA |
| en-US, es-ES | USD | price_1T0TGaJH1fRNsXz1x9NUlNUi | price_1T0TK5JH1fRNsXz18TSaGs8t |
| it-IT, pt-PT | EUR | price_1T0TGtJH1fRNsXz1NJgJomfj | price_1T0TJmJH1fRNsXz1DOEJGiBo |

## Alteracoes

### 1. `src/config/pricing.ts` -- reestruturar completamente

- Remover `STRIPE_PRICES` e `DISPLAY_PRICES` antigos (priceId unico)
- Criar tipo `Currency = 'BRL' | 'USD' | 'EUR'`
- Criar `LOCALE_CURRENCY_MAP` que mapeia idioma para moeda:
  - `pt-BR` -> `BRL`
  - `en-US`, `es-ES` -> `USD`
  - `it-IT`, `pt-PT` -> `EUR`
- Criar `PRICE_MAP` com priceIds e precos de exibicao por moeda:
  ```
  { monthly: { BRL: { priceId, price }, USD: { ... }, EUR: { ... } },
    yearly:  { BRL: { priceId, price }, USD: { ... }, EUR: { ... } } }
  ```
- Exportar `getCurrencyFromLocale(locale: string): Currency`
- Exportar `getPriceId(cycle, locale): string`
- Exportar `getDisplayPrice(cycle, locale): number`
- Atualizar `formatPrice(price, currency)` para usar `Intl.NumberFormat` com moeda correta
- Atualizar `calculateYearlySavings(locale)` para calcular por moeda
- Manter `MODE` test/production (test continua com BRL apenas)

Precos de exibicao (devem corresponder ao configurado no Stripe):

| Moeda | Mensal | Anual |
|-------|--------|-------|
| BRL | 24.90 | 239.04 |
| USD | 4.90 | 47.04 |
| EUR | 4.50 | 43.20 |

**Nota**: Se os valores nao corresponderem aos precos reais no Stripe, serao facilmente ajustaveis neste arquivo.

### 2. `src/components/PlansSection.tsx`

- Importar `useTranslation` para obter `i18n.language`
- Importar novos helpers: `getCurrencyFromLocale`, `getPriceId`, `getDisplayPrice`, `formatPrice`
- No `handleCheckout`: usar `getPriceId(cycle, i18n.language)` em vez de `STRIPE_PRICES[cycle]`
- Enviar `{ priceId, locale: i18n.language }` no body do checkout
- Na exibicao: usar `formatPrice(getDisplayPrice(cycle, i18n.language), getCurrencyFromLocale(i18n.language))`
- Mesma logica para o preco anual total

### 3. `src/pages/ChoosePlan.tsx`

- Mesmas alteracoes do PlansSection: usar helpers baseados no idioma
- Adicionar `useTranslation` (ainda nao usa)
- Substituir `STRIPE_PRICES[cycle]` por `getPriceId(cycle, i18n.language)`
- Substituir `formatPrice(displayPrice)` por `formatPrice(getDisplayPrice(cycle, i18n.language), getCurrencyFromLocale(i18n.language))`

### 4. `src/components/UpgradeModal.tsx`

- O UpgradeModal usa `subscription_plans` do banco com `stripe_price_id_monthly/yearly` -- esses priceIds vem do banco e sao fixos em BRL
- Para multi-moeda no UpgradeModal, seria necessario adicionar colunas no banco para cada moeda, o que e complexo
- **Acao minima**: atualizar a formatacao de `R$` hardcoded para usar `formatPrice()` com a moeda do locale, mas manter os priceIds vindos do banco (BRL)
- Adicionar um comentario `// TODO: multi-currency priceIds from DB` para evolucao futura

### 5. `src/hooks/useCheckout.ts`

- Nenhuma alteracao necessaria -- ja recebe `priceId` como parametro

### 6. `supabase/functions/create-checkout/index.ts`

- Nenhuma alteracao necessaria -- ja recebe `priceId` no body e usa diretamente. O campo `locale` extra sera ignorado pelo backend (nao causa erro).

## Arquivos modificados

| Arquivo | Tipo |
|---------|------|
| `src/config/pricing.ts` | Reestruturar com mapa multi-moeda |
| `src/components/PlansSection.tsx` | Usar helpers por idioma |
| `src/pages/ChoosePlan.tsx` | Usar helpers por idioma |
| `src/components/UpgradeModal.tsx` | Atualizar formatacao de preco |

## O que NAO muda

- Edge function `create-checkout` (ja aceita qualquer priceId)
- `stripe-webhook`
- Fluxo de onboarding
- Rotas
- Banco de dados
- Nenhum componente novo de seletor de moeda
