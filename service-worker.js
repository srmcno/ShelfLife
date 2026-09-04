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

// Network-first for this app's own code, cache-first for everything else.
//
// Cache-first on our own JS/CSS/HTML was actively harmful: after a new version
// shipped, a returning player kept getting the OLD cached code and would not see
// fixes at all (the fresh copy only landed on the visit AFTER next). For a game
// still changing, silently serving stale code is worse than a brief network wait.
// Offline still works — we fall back to cache whenever the network fails.
const APP_CODE = /\.(?:js|css|html|webmanifest)$/i;

function isAppCode(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return APP_CODE.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isAppCode(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (icons, fonts, images): cache-first with background refresh.
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
