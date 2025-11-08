import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

// Registrar Service Worker para controle de cache
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registered successfully:', registration.scope);
        
        // Checar atualizações a cada 60 segundos
        setInterval(() => {
          console.log('[SW] Checking for updates...');
          registration.update();
        }, 60000);
        
        // Escutar por novas versões instaladas
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version available!');
                // A notificação será mostrada pelo versionCheck no App.tsx
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
