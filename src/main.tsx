import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

console.log('[MAIN] App inicializando...');

// Função AGRESSIVA para buscar versão remota - tenta version.txt primeiro
async function fetchRemoteVersion(timeoutMs = 1500): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    // Tentar version.txt primeiro (texto puro, menos cache)
    const resTxt = await fetch('/version.txt?cb=' + Date.now(), {
      cache: 'no-store',
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    
    if (resTxt.ok) {
      const txt = await resTxt.text();
      const version = txt.trim().replace('v-', '');
      console.log('[VERSION] Versão remota (txt):', version);
      return version;
    }
  } catch (e) {
    console.warn('[VERSION] Erro ao buscar version.txt, tentando version.json:', e);
  }
  
  // Fallback: tentar version.json
  clearTimeout(timer);
  const timer2 = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const resJson = await fetch('/version.json?cb=' + Date.now(), {
      cache: 'no-store',
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      signal: controller.signal,
    });
    clearTimeout(timer2);
    
    if (!resJson.ok) {
      console.warn('[VERSION] HTTP', resJson.status);
      return null;
    }
    
    const json = await resJson.json();
    console.log('[VERSION] Versão remota (json):', json.version);
    return String(json.version || '');
  } catch (e) {
    clearTimeout(timer2);
    console.warn('[VERSION] Erro ao buscar version.json:', e);
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
    
    // Verificação AGRESSIVA periódica em background (a cada 30 segundos)
    setInterval(async () => {
      const local = localStorage.getItem('app_version') || '';
      const remote = await fetchRemoteVersion(2000);
      
      if (remote && remote !== local) {
        console.log('[VERSION] NOVA VERSÃO DETECTADA EM BACKGROUND! Remote:', remote, 'Local:', local);
        console.log('[VERSION] Forçando atualização automática...');
        await clearAllAndReload(remote);
      }
    }, 30 * 1000); // 30 segundos
  })();
}
