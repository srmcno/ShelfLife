const CACHE_VERSION = 'shelflife-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './src/main.js',
  './src/state.js',
  './src/content/traits.js',
  './src/content/feuds.js',
  './src/content/copy.js',
  './src/content/props.js',
  './src/content/decor.js',
  './src/content/mature.js',
  './src/engine/tick.js',
  './src/engine/care.js',
  './src/engine/unlocks.js',
  './src/engine/achievements.js',
  './src/engine/loop.js',
  './src/art/stamps.js',
  './src/art/sprite.js',
  './src/art/studio.js',
  './src/audio/sound.js',
  './src/audio/narrator.js',
  './src/ui/render.js',
  './src/ui/toast.js',
  './src/ui/card.js',
  './src/ui/decorUI.js',
  './src/ui/drag.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
