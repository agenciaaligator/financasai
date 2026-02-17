import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

console.log('[MAIN] App inicializando...');

// Função AGRESSIVA para buscar versão remota - tenta version.txt primeiro
async function fetchRemoteVersion(timeoutMs = 1500): Promise<string | null> {
  // Desabilitar em desenvolvimento para evitar loop infinito
  if (import.meta.env.DEV) {
    console.log('[VERSION] Modo dev - skip verificação remota');
    return null;
  }
  
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

// ⚠️ RECOVERY FLOW (2/4) — Este arquivo faz parte de uma cadeia de 4 arquivos:
//   index.html → main.tsx → App.tsx → ResetPassword.tsx
// A função clearAllAndReload preserva flags de recovery do sessionStorage
// durante o ciclo de limpeza de cache/storage. Se novas chaves de sessão forem
// adicionadas ao app, inclua-as na STORAGE_PRESERVE_KEYS abaixo.
// NÃO altere a lógica de limpeza sem verificar os outros 3 arquivos.

// Chaves do sessionStorage que devem sobreviver ao ciclo de limpeza.
// Ao adicionar novo estado persistido no sessionStorage, inclua a chave aqui
// para que não seja perdida durante atualizações automáticas de versão.
const STORAGE_PRESERVE_KEYS = [
  'supabase_recovery',
  'supabase_recovery_hash',
  'supabase_recovery_path',
] as const;

// Função para limpar tudo e recarregar
async function clearAllAndReload(newVersion: string) {
  console.log('[VERSION] Limpando caches e recarregando para versão:', newVersion);

  // Preservar chaves da allowlist ANTES de limpar
  const preserved: Record<string, string> = {};
  for (const key of STORAGE_PRESERVE_KEYS) {
    const value = sessionStorage.getItem(key);
    if (value !== null) {
      preserved[key] = value;
    }
  }

  try {
    // Limpar storage
    localStorage.clear();
    sessionStorage.clear();

    // Restaurar chaves preservadas
    for (const [key, value] of Object.entries(preserved)) {
      sessionStorage.setItem(key, value);
    }

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
    // Redirecionar para o path original (não sempre /)
    const targetPath = preserved['supabase_recovery_path'] || window.location.pathname || '/';
    window.location.replace(targetPath + '?v=' + newVersion);
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
      return;
    }
    
    console.log('[VERSION] Versão atual:', localVersion || 'primeira execução');
    
    // Renderizar app normalmente (sem background interval)
    createRoot(document.getElementById("root")!).render(<App />);
  })();
}
