// Bump for every release that changes the application shell.
const CACHE_VERSION = 'shelflife-v7';
const CACHE_PREFIX = 'shelflife-';
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/fonts.css",
  "./css/style.css",
  "./src/art/anatomy.js",
  "./src/art/animator.js",
  "./src/art/creatures.js",
  "./src/art/drawing.js",
  "./src/art/joints.js",
  "./src/art/sprite.js",
  "./src/art/stamps.js",
  "./src/art/studio.js",
  "./src/audio/narrator.js",
  "./src/audio/sound.js",
  "./src/content/bubbles.js",
  "./src/content/care.js",
  "./src/content/copy.js",
  "./src/content/decor.js",
  "./src/content/dialogue.js",
  "./src/content/feuds.js",
  "./src/content/mature.js",
  "./src/content/postcards.js",
  "./src/content/props.js",
  "./src/content/schemes.js",
  "./src/content/stories.js",
  "./src/content/traits.js",
  "./src/engine/achievements.js",
  "./src/engine/behavior.js",
  "./src/engine/care.js",
  "./src/engine/chase.js",
  "./src/engine/play.js",
  "./src/engine/stories.js",
  "./src/engine/personality.js",
  "./src/engine/dialogue.js",
  "./src/engine/loop.js",
  "./src/engine/schemes.js",
  "./src/engine/tick.js",
  "./src/engine/unlocks.js",
  "./src/main.js",
  "./src/state.js",
  "./src/ui/card.js",
  "./src/ui/chase.js",
  "./src/ui/play.js",
  "./src/ui/stories.js",
  "./src/ui/decorUI.js",
  "./src/ui/dialogs.js",
  "./src/ui/drag.js",
  "./src/ui/nav.js",
  "./src/ui/postcard.js",
  "./src/ui/render.js",
  "./src/ui/schemes.js",
  "./src/ui/toast.js",
  "./assets/fonts/caveat-500-normal.ttf",
  "./assets/fonts/caveat-600-normal.ttf",
  "./assets/fonts/gloock-400-normal.ttf",
  "./assets/fonts/karla-400-italic.ttf",
  "./assets/fonts/karla-400-normal.ttf",
  "./assets/fonts/karla-600-normal.ttf",
  "./assets/fonts/karla-700-normal.ttf",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Respect other apps on the same origin and leave third-party requests alone.
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  const isCode = /\.(js|css|html|webmanifest)$/i.test(url.pathname) || request.mode === 'navigate' || url.pathname.endsWith('/');
  if (!isCode && !url.pathname.includes('/icons/') && !url.pathname.includes('/assets/fonts/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (!isCode && cached) return cached;
    // A stalled connection should not strand an installed offline game.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(request, { signal: controller.signal, cache: isCode ? 'no-cache' : 'default' });
      if (response.ok) {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
        return response;
      }
      return cached || response;
    } catch {
      return cached || (request.mode === 'navigate' && await cache.match('./index.html')) ||
        new Response('Shelf Life could not load this file. Reconnect and try again.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    } finally { clearTimeout(timeout); }
  })());
});
