/**
 * Analytics centralizado — PostHog + Google Analytics 4.
 *
 * Como configurar:
 *   Coloque as chaves em .env (prefixo VITE_ obrigatório pra Vite expor no cliente):
 *     VITE_POSTHOG_KEY="phc_..."
 *     VITE_POSTHOG_HOST="https://us.i.posthog.com" (ou https://eu.i.posthog.com)
 *     VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
 *
 * Se qualquer chave estiver vazia, aquela plataforma simplesmente não é
 * inicializada — o código continua funcionando normalmente, só não envia dados.
 *
 * Uso:
 *   import { track, identify } from "@/lib/analytics";
 *   track("checkout_started", { plan: "monthly", currency: "BRL", value: 24.90 });
 *   identify(user.id, { email: user.email });
 */

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const PH_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    posthog?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer?: any[];
  }
}

const isValidKey = (k?: string) =>
  !!k && k.length > 10 && !k.toLowerCase().includes("your_") && !k.toLowerCase().includes("xxxx");

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // --- PostHog ---
  if (isValidKey(PH_KEY)) {
    try {
      // Snippet oficial PostHog (sem precisar npm install)
      const script = document.createElement("script");
      script.innerHTML = `
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('${PH_KEY}', { api_host: '${PH_HOST}', person_profiles: 'identified_only', capture_pageview: false, capture_pageleave: true });
      `;
      document.head.appendChild(script);
      console.log("[analytics] PostHog initialized");
    } catch (e) {
      console.warn("[analytics] PostHog init failed:", e);
    }
  }

  // --- Google Analytics 4 ---
  if (isValidKey(GA_ID)) {
    try {
      const gtagScript = document.createElement("script");
      gtagScript.async = true;
      gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      document.head.appendChild(gtagScript);

      window.dataLayer = window.dataLayer || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.gtag = function (...args: any[]) {
        window.dataLayer!.push(args);
      } as (...args: unknown[]) => void;
      window.gtag("js", new Date());
      // send_page_view: false — vamos controlar manualmente via trackPageView() pra SPA
      window.gtag("config", GA_ID, { send_page_view: false });
      console.log("[analytics] GA4 initialized");
    } catch (e) {
      console.warn("[analytics] GA4 init failed:", e);
    }
  }
}

export function track(event: string, properties?: Record<string, unknown>) {
  // PostHog
  try {
    if (window.posthog?.capture) {
      window.posthog.capture(event, properties);
    }
  } catch (e) {
    console.warn("[analytics] PostHog capture failed:", e);
  }

  // GA4
  try {
    if (window.gtag) {
      window.gtag("event", event, properties || {});
    }
  } catch (e) {
    console.warn("[analytics] GA4 event failed:", e);
  }
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  try {
    if (window.posthog?.identify) {
      window.posthog.identify(userId, traits);
    }
  } catch (e) {
    console.warn("[analytics] PostHog identify failed:", e);
  }

  try {
    if (window.gtag && isValidKey(GA_ID)) {
      if (traits) window.gtag("set", "user_properties", traits);
      window.gtag("config", GA_ID, { user_id: userId });
    }
  } catch (e) {
    console.warn("[analytics] GA4 identify failed:", e);
  }
}

export function trackPageView(path: string, title?: string) {
  try {
    if (window.posthog?.capture) {
      window.posthog.capture("$pageview", {
        $current_url: window.location.origin + path,
        $pathname: path,
        $title: title,
      });
    }
  } catch (e) {
    console.warn("[analytics] PostHog pageview failed:", e);
  }

  try {
    if (window.gtag && isValidKey(GA_ID)) {
      window.gtag("event", "page_view", {
        page_path: path,
        page_title: title,
        page_location: window.location.origin + path,
      });
    }
  } catch (e) {
    console.warn("[analytics] GA4 pageview failed:", e);
  }
}

export function reset() {
  try {
    if (window.posthog?.reset) {
      window.posthog.reset();
    }
  } catch (e) {
    console.warn("[analytics] reset failed:", e);
  }
}
