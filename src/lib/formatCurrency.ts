import i18n from '@/i18n';

/**
 * Formats a number as BRL currency using the active locale's number format.
 * The currency is always BRL (product is Brazilian), but the format adapts
 * to the user's language (e.g., 1.000,00 vs 1,000.00).
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
