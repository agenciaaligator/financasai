import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

/**
 * Dispara pageview no PostHog + GA4 toda vez que o React Router muda a rota.
 * Pra SPA, isso é obrigatório (as plataformas de analytics não detectam
 * mudança de rota automaticamente sem reload).
 *
 * Uso: chamar uma única vez em App.tsx dentro do BrowserRouter.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + location.search;
    trackPageView(path, document.title);
  }, [location.pathname, location.search]);
}
