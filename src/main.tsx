import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

// Detectar mobile e forçar limpeza completa
const isMobile = window.innerWidth <= 768;
const currentVersion = '2024-11-08-v2'; // Incrementar em cada deploy crítico

if (isMobile) {
  console.log('[MOBILE CACHE BUSTING] Detectado mobile, iniciando limpeza...');
  
  // Verificar se é uma nova versão
  const lastClearVersion = localStorage.getItem('last_cache_clear');
  
  if (lastClearVersion !== currentVersion) {
    console.log('[MOBILE CACHE BUSTING] Nova versão detectada:', currentVersion, 'anterior:', lastClearVersion);
    
    // Limpar todos os storages
    localStorage.clear();
    sessionStorage.clear();
    
    // Salvar nova versão
    localStorage.setItem('last_cache_clear', currentVersion);
    
    console.log('[MOBILE CACHE BUSTING] Caches limpos, recarregando...');
    
    // Forçar reload sem cache
    window.location.reload();
  }
}

// Limpar Service Workers e caches existentes
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('[CACHE BUSTING] Unregistering SW:', registration);
      registration.unregister();
    });
  });
  if (window.caches?.keys) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        console.log('[CACHE BUSTING] Deleting cache:', cacheName);
        caches.delete(cacheName);
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
