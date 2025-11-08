const CACHE_VERSION = 'v1-BUILD_TIME_PLACEHOLDER';
const ASSETS_TO_CACHE = ['/'];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version:', CACHE_VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Sempre buscar index.html e root da rede (network-first)
  if (url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.includes('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
  // version.json sempre da rede (para detecção de versão)
  if (url.pathname.includes('version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
    );
    return;
  }
  
  // Para assets (js, css, images), usar cache-first
  if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchResponse) => {
          return caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }
  
  // Para tudo mais, network-first
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
