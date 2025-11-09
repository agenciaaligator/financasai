import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

// Versão já foi verificada pelo script inline no index.html
console.log('[MAIN] App inicializando...');

// Detectar logout pelos query params
const urlParams = new URLSearchParams(window.location.search);
const isLogout = urlParams.get('logout') || urlParams.get('force');

if (isLogout) {
  console.log('[MAIN] Logout/Force detectado nos params - limpando tudo...');
  localStorage.clear();
  sessionStorage.clear();
  
  // Limpar caches
  if ('caches' in window) {
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }
  
  // Remover query params e recarregar limpo
  window.history.replaceState({}, document.title, '/');
  window.location.reload();
}

// Limpar Service Workers residuais (caso existam)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      console.log('[CACHE BUSTING] Unregistering SW:', registration);
      registration.unregister();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
