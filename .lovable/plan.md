

# Enviar locale ao Stripe Checkout

## Resumo

O frontend ja envia `locale` no body para `create-checkout`, mas a edge function ignora esse campo. A unica alteracao necessaria e na edge function: extrair o `locale` do body e passa-lo para `stripe.checkout.sessions.create({ locale })`.

## Mapeamento de locale

O Stripe aceita locales curtos (ex: `en`, `pt`, `es`, `it`). O frontend envia locales como `pt-BR`, `en-US`, etc. A edge function deve converter para o formato Stripe:

| Frontend | Stripe |
|----------|--------|
| pt-BR | pt-BR |
| pt-PT | pt |
| en-US | en |
| es-ES | es |
| it-IT | it |

Stripe suporta `pt-BR` como locale valido, entao pt-BR pode ser enviado diretamente. Para os demais, usar apenas a parte antes do hifen.

## Alteracoes

### 1. `supabase/functions/create-checkout/index.ts`

- Linha 34: Extrair `locale` do body junto com `priceId` e `email`
- Criar helper para converter locale do frontend para formato Stripe (ex: `en-US` -> `en`, `pt-BR` -> `pt-BR`)
- Linha 70-84: Adicionar `locale: stripeLocale` ao `checkoutConfig`

Codigo relevante:

```typescript
// Extrair locale do body
const { priceId, email: providedEmail, locale } = await req.json();

// Converter para formato Stripe
const getStripeLocale = (loc?: string): string | undefined => {
  if (!loc) return undefined;
  if (loc === 'pt-BR') return 'pt-BR';
  return loc.split('-')[0]; // en-US -> en, es-ES -> es, it-IT -> it
};

// Adicionar ao checkoutConfig
const checkoutConfig = {
  ...existingConfig,
  locale: getStripeLocale(locale),
};
```

### 2. Frontend (PlansSection.tsx, ChoosePlan.tsx)

Nenhuma alteracao necessaria -- ambos ja enviam `{ priceId, locale }` no body.

## Arquivos modificados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/create-checkout/index.ts` | Extrair locale e passar ao Stripe |

## O que NAO muda

- priceIds
- Logica de autenticacao
- Frontend (ja envia locale)
- stripe-webhook
- Rotas

