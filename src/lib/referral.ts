/**
 * Captura e persiste o código de afiliado (?ref=CODIGO) até o cadastro
 * ser concluído. Guardado em localStorage para sobreviver a navegação
 * entre páginas antes do usuário assinar.
 */
const STORAGE_KEY = "dw_referral_code";

export function captureReferralCode(searchParams: URLSearchParams): void {
  const ref = searchParams.get("ref");
  if (ref && ref.trim()) {
    localStorage.setItem(STORAGE_KEY, ref.trim().toUpperCase());
  }
}

export function getStoredReferralCode(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearReferralCode(): void {
  localStorage.removeItem(STORAGE_KEY);
}
