const CACHE_NAME = 'songify-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Przepuszczamy zapytania strumieniowania audio i API sieciowo
  if (event.request.url.includes('/api/') || event.request.url.includes('dzcdn.net')) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});