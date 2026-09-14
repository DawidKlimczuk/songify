const CACHE_NAME = 'songify-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorujemy zapytania streamujące YouTube i API zewnętrzne
  if (
    event.request.url.includes('youtube.com') ||
    event.request.url.includes('googlevideo.com') ||
    event.request.url.includes('/api/audio/stream')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});