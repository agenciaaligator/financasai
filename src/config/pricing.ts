// ============================================
// CONFIGURAÇÃO CENTRALIZADA DE PREÇOS
// ============================================
// Para trocar entre TESTE e PRODUÇÃO, altere apenas o MODE abaixo

type PricingMode = 'test' | 'production';

// 👇 ALTERE AQUI PARA TROCAR ENTRE TESTE E PRODUÇÃO
const MODE: PricingMode = 'test';

export const PRICING = {
  test: {
    monthly: {
      priceId: 'price_1SbmlUJH1fRNsXz1xV238gzq',
      price: 1.00,
    },
    yearly: {
      priceId: 'price_1SbqsUJH1fRNsXz1DEQjETOw',
      price: 10.00,
    },
  },
  production: {
    monthly: {
      priceId: 'price_1SbmaXJH1fRNsXz1vvmAtvvq',
      price: 24.90,
    },
    yearly: {
      priceId: 'price_1SSi5nJH1fRNsXz18jwx0OPS',
      price: 239.04,
    },
  },
} as const;

// Exportar preços ativos baseado no modo
export const ACTIVE_PRICING = PRICING[MODE];

export const STRIPE_PRICES = {
  monthly: ACTIVE_PRICING.monthly.priceId,
  yearly: ACTIVE_PRICING.yearly.priceId,
};

export const DISPLAY_PRICES = {
  monthly: ACTIVE_PRICING.monthly.price,
  yearly: ACTIVE_PRICING.yearly.price,
  yearlyMonthlyEquivalent: ACTIVE_PRICING.yearly.price / 12,
};

// Helper para formatar preço em BRL
export const formatPrice = (price: number): string => {
  return `R$ ${price.toFixed(2).replace('.', ',')}`;
};

// Calcular economia do plano anual
export const calculateYearlySavings = (): number => {
  const monthlyTotal = DISPLAY_PRICES.monthly * 12;
  const yearlyTotal = DISPLAY_PRICES.yearly;
  return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100);
};

// Modo atual (para debug/exibição)
export const CURRENT_MODE = MODE;
