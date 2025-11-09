import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

console.log('[MAIN] App inicializando...');

// Função para buscar versão remota sem cache
async function fetchRemoteVersion(timeoutMs = 2000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch('/version.json?cb=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    
    if (!res.ok) {
      console.warn('[VERSION] HTTP', res.status);
      return null;
    }
    
    const json = await res.json();
    return String(json.version || '');
  } catch (e) {
    clearTimeout(timer);
    console.warn('[VERSION] Erro ao buscar versão remota:', e);
    return null;
  }
}

// Função para limpar tudo e recarregar
async function clearAllAndReload(newVersion: string) {
  console.log('[VERSION] Limpando caches e recarregando para versão:', newVersion);
  
  try {
    // Limpar storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Limpar Cache API
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    
    // Unregister Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    
    // Salvar nova versão
    localStorage.setItem('app_version', newVersion);
  } catch (e) {
    console.error('[VERSION] Erro ao limpar caches:', e);
  } finally {
    // Hard reload com query string
    window.location.replace('/?v=' + newVersion);
  }
}

// Detectar logout/force pelos query params
const urlParams = new URLSearchParams(window.location.search);
const isLogout = urlParams.get('logout') || urlParams.get('force');

if (isLogout) {
  console.log('[MAIN] Logout/Force detectado - limpando tudo...');
  clearAllAndReload(Date.now().toString()).then(() => {
    window.history.replaceState({}, document.title, '/');
  });
} else {
  // Verificação de versão remota ANTES de renderizar
  (async () => {
    const localVersion = localStorage.getItem('app_version') || '';
    const remoteVersion = await fetchRemoteVersion(2000);
    
    if (remoteVersion && remoteVersion !== localVersion) {
      console.log('[VERSION] NOVA VERSÃO DETECTADA! Remote:', remoteVersion, 'Local:', localVersion);
      await clearAllAndReload(remoteVersion);
      return; // Não renderizar - vai recarregar
    }
    
    console.log('[VERSION] Versão atual:', localVersion || 'primeira execução');
    
    // Renderizar app normalmente
    createRoot(document.getElementById("root")!).render(<App />);
    
    // Verificação periódica em background (a cada 5 minutos)
    setInterval(async () => {
      const local = localStorage.getItem('app_version') || '';
      const remote = await fetchRemoteVersion(3000);
      
      if (remote && remote !== local) {
        console.log('[VERSION] Atualização disponível em background. Remote:', remote, 'Local:', local);
        // Aqui poderia mostrar um toast, mas por enquanto só loga
        // Para evitar interromper o usuário sem aviso
      }
    }, 5 * 60 * 1000); // 5 minutos
  })();
}
