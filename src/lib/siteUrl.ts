/**
 * URL canônica oficial do sistema.
 *
 * Esta é a ÚNICA fonte de verdade para construir links que sairão do app
 * (e-mails de autenticação, redirects de checkout, links em mensagens, etc.).
 *
 * Regra de ouro: NUNCA usar `window.location.origin` para montar links que
 * serão entregues ao usuário (e-mail, Stripe, WhatsApp). Use `getSiteUrl()`.
 */
export const CANONICAL_SITE_URL = "https://donawilma.com.br";

/**
 * Retorna a URL base oficial do site.
 *
 * - Em produção (qualquer domínio publicado): sempre `https://donawilma.com.br`.
 * - Em desenvolvimento local (`localhost` / `127.0.0.1`): usa o `origin` atual
 *   para que o link de e-mail aberto em DEV volte para o ambiente local.
 *
 * Domínios de preview (`*.lovable.app`, `*.lovableproject.com`, `*.vercel.app`)
 * NUNCA são usados como base — eles redirecionariam para o app errado.
 */
export function getSiteUrl(): string {
  if (typeof window === "undefined") {
    return CANONICAL_SITE_URL;
  }

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local");

  if (isLocal) {
    return window.location.origin;
  }

  return CANONICAL_SITE_URL;
}

/**
 * Constrói uma URL absoluta a partir de uma rota relativa, sempre usando
 * o domínio canônico do site.
 *
 * Exemplo: `buildSiteUrl("/reset-password")` → `https://donawilma.com.br/reset-password`
 */
export function buildSiteUrl(path: string): string {
  const base = getSiteUrl().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
