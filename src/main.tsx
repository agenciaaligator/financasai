import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n'

// Limpar Service Workers e caches existentes
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => registration.unregister());
  });
  if (window.caches?.keys) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => caches.delete(cacheName));
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
