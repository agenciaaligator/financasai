// ============================================
// CONFIGURAÇÃO CENTRALIZADA DE PREÇOS
// Mapeamento automático por idioma → moeda
// ============================================

type PricingMode = 'test' | 'production';
export type Currency = 'BRL' | 'USD' | 'EUR';

// 👇 ALTERE AQUI PARA TROCAR ENTRE TESTE E PRODUÇÃO
const MODE: PricingMode = 'production';

// Mapeamento idioma → moeda
export const LOCALE_CURRENCY_MAP: Record<string, Currency> = {
  'pt-BR': 'BRL',
  'en-US': 'USD',
  'es-ES': 'USD',
  'it-IT': 'EUR',
  'pt-PT': 'EUR',
};

// Preços de produção por moeda
const PRICE_MAP = {
  production: {
    monthly: {
      BRL: { priceId: 'price_1T0RbZJH1fRNsXz1rT6ThCQb', price: 24.90 },
      USD: { priceId: 'price_1T0TGaJH1fRNsXz1x9NUlNUi', price: 4.90 },
      EUR: { priceId: 'price_1T0TGtJH1fRNsXz1NJgJomfj', price: 4.50 },
    },
    yearly: {
      BRL: { priceId: 'price_1T0TJPJH1fRNsXz1UhcqKorA', price: 239.04 },
      USD: { priceId: 'price_1T0TK5JH1fRNsXz18TSaGs8t', price: 47.04 },
      EUR: { priceId: 'price_1T0TJmJH1fRNsXz1DOEJGiBo', price: 43.20 },
    },
  },
  test: {
    monthly: {
      BRL: { priceId: 'price_1SbmlUJH1fRNsXz1xV238gzq', price: 1.00 },
      USD: { priceId: 'price_1SbmlUJH1fRNsXz1xV238gzq', price: 1.00 },
      EUR: { priceId: 'price_1SbmlUJH1fRNsXz1xV238gzq', price: 1.00 },
    },
    yearly: {
      BRL: { priceId: 'price_1SbqsUJH1fRNsXz1DEQjETOw', price: 10.00 },
      USD: { priceId: 'price_1SbqsUJH1fRNsXz1DEQjETOw', price: 10.00 },
      EUR: { priceId: 'price_1SbqsUJH1fRNsXz1DEQjETOw', price: 10.00 },
    },
  },
} as const;

// Helpers
export const getCurrencyFromLocale = (locale: string): Currency => {
  return LOCALE_CURRENCY_MAP[locale] || 'BRL';
};

export const getPriceId = (cycle: 'monthly' | 'yearly', locale: string): string => {
  const currency = getCurrencyFromLocale(locale);
  return PRICE_MAP[MODE][cycle][currency].priceId;
};

export const getDisplayPrice = (cycle: 'monthly' | 'yearly', locale: string): number => {
  const currency = getCurrencyFromLocale(locale);
  return PRICE_MAP[MODE][cycle][currency].price;
};

export const getYearlyMonthlyEquivalent = (locale: string): number => {
  return getDisplayPrice('yearly', locale) / 12;
};

// Formatar preço com Intl.NumberFormat
export const formatPrice = (price: number, currency?: Currency): string => {
  const cur = currency || 'BRL';
  const localeMap: Record<Currency, string> = {
    BRL: 'pt-BR',
    USD: 'en-US',
    EUR: 'de-DE',
  };
  return new Intl.NumberFormat(localeMap[cur], {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(price);
};

// Calcular economia do plano anual por moeda
export const calculateYearlySavings = (locale: string = 'pt-BR'): number => {
  const monthlyTotal = getDisplayPrice('monthly', locale) * 12;
  const yearlyTotal = getDisplayPrice('yearly', locale);
  return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100);
};

// Modo atual (para debug)
export const CURRENT_MODE = MODE;

// Backwards compatibility exports (deprecated)
export const STRIPE_PRICES = {
  monthly: PRICE_MAP[MODE].monthly.BRL.priceId,
  yearly: PRICE_MAP[MODE].yearly.BRL.priceId,
};

export const DISPLAY_PRICES = {
  monthly: PRICE_MAP[MODE].monthly.BRL.price,
  yearly: PRICE_MAP[MODE].yearly.BRL.price,
  yearlyMonthlyEquivalent: PRICE_MAP[MODE].yearly.BRL.price / 12,
};
