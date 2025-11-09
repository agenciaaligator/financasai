import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

export function ForceUpdateButton() {
  const handleForceUpdate = async () => {
    console.log('[FORCE UPDATE] Limpando todos os caches...');
    
    try {
      // Limpar storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Limpar Cache API
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
        console.log('[FORCE UPDATE] Cache API limpo');
      }
      
      // Unregister Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        console.log('[FORCE UPDATE] Service Workers removidos');
      }
    } catch (e) {
      console.error('[FORCE UPDATE] Erro ao limpar:', e);
    }
    
    // Hard reload com cache busting
    const timestamp = Date.now();
    console.log('[FORCE UPDATE] Forçando reload com timestamp:', timestamp);
    window.location.replace(window.location.pathname + '?force_update=' + timestamp);
  };

  return (
    <Button
      onClick={handleForceUpdate}
      variant="outline"
      size="sm"
      className="fixed top-4 right-4 z-50 shadow-lg bg-background/95 backdrop-blur-sm border-2"
      title="Forçar atualização do app (limpa cache)"
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Atualizar App
    </Button>
  );
}
