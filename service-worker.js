// Bump for every release that changes the application shell.
const CACHE_VERSION = 'shelflife-v46';
const CACHE_PREFIX = 'shelflife-';
const SHELL = [
  "./src/content/mayhem.js",
  "./src/mayhem-state.js",
  "./src/engine/mayhem.js",
  "./src/ui/mayhem.js",
  "./src/art/mayhem-glyphs.js",
  "./css/mayhem.css",
  "./css/atmosphere.css",
  "./css/games.css",
  "./src/content/arcade.js",
  "./src/engine/arcade.js",
  "./src/arcade-state.js",
  "./src/ui/arcade.js",
  "./src/mastery-state.js",
  "./src/household-echoes.js",
  "./src/content/rug-comedy.js",
  "./src/play-rug-state.js",
  "./src/engine/play-rug.js",
  "./src/ui/play-rug.js",
  "./css/play-rug.css",
  "./css/room.css",
  "./css/paperwork.css",
  "./src/paperwork-state.js",
  "./src/art/expedition-stage.js",
  "./assets/rooms/play-rug.webp",
  "./src/content/escapades.js",
  "./src/content/escapades-legacy.js",
  "./src/escapade-state.js",
  "./src/engine/escapades.js",
  "./src/art/keepsakes.js",
  "./src/ui/escapades.js",
  "./css/escapades.css",
  "./src/content/arrivals.js",
  "./src/ui/arrival.js",
  "./css/home.css",
  "./css/playroom.css",
  "./src/engine/welcome.js",
  "./src/ui/welcome.js",
  "./src/engine/resident-memory.js",
  "./src/content/resident-life.js",
  "./src/content/pair-sagas.js",
  "./src/engine/pair-sagas.js",
  "./src/content/project-encounters.js",
  "./css/household.css",
  "./src/theatre-state.js",
  "./src/content/shelf-theatre.js",
  "./src/engine/shelf-theatre.js",
  "./src/art/shelf-theatre.js",
  "./src/ui/shelf-theatre.js",
  "./src/ui/theatre-visibility.js",
  "./css/shelf-theatre.css",
  "./css/theatre-controls.css",
  "./css/controls.css",
  "./src/engine/creation.js",
  "./css/character.css",
  "./src/backup.js",
  "./src/ui/backup.js",
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
  "./src/art/studio-model.js",
  "./src/audio/narrator.js",
  "./src/audio/sound.js",
  "./src/content/bubbles.js",
  "./src/content/care.js",
  "./src/content/copy.js",
  "./src/content/decor.js",
  "./src/content/dialogue.js",
  "./src/content/observations.js",
  "./src/content/feuds.js",
  "./src/content/inner.js",
  "./src/content/postcards.js",
  "./src/content/props.js",
  "./src/content/schemes.js",
  "./src/content/stories.js",
  "./src/content/traits.js",
  "./src/engine/achievements.js",
  "./src/engine/behavior.js",
  "./src/engine/care.js",
  "./src/engine/stories.js",
  "./src/engine/personality.js",
  "./src/engine/dialogue.js",
  "./src/engine/observations.js",
  "./src/engine/loop.js",
  "./src/engine/schemes.js",
  "./src/engine/tick.js",
  "./src/engine/unlocks.js",
  "./src/main.js",
  "./src/life-state.js",
  "./src/engine/life.js",
  "./src/content/life.js",
  "./src/content/projects.js",
  "./src/ui/life.js",
  "./src/ui/expeditions.js",
  "./src/art/household-scene.js",
  "./src/content/scenes.js",
  "./src/art/curios.js",
  "./css/life.css",
  "./css/expeditions.css",
  "./css/phone.css",
  "./css/game-shell.css",
  "./css/animation.css",
  "./css/scenes.css",
  "./src/state.js",
  "./src/ui/card.js",
  "./src/ui/playroom.js",
  "./src/ui/stories.js",
  "./src/ui/decorUI.js",
  "./src/ui/dialogs.js",
  "./src/ui/drag.js",
  "./src/ui/nav.js",
  "./src/ui/postcard.js",
  "./src/ui/render.js",
  "./src/ui/effects.js",
  "./src/ui/schemes.js",
  "./src/ui/toast.js",
  "./assets/fonts/caveat-500-normal.woff2",
  "./assets/fonts/caveat-600-normal.woff2",
  "./assets/fonts/gloock-400-normal.woff2",
  "./assets/fonts/karla-400-italic.woff2",
  "./assets/fonts/karla-400-normal.woff2",
  "./assets/fonts/karla-600-normal.woff2",
  "./assets/fonts/karla-700-normal.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
// Every installed asset must also be eligible for offline delivery. Keeping
// this tied to the manifest prevents new illustration folders being missed.
const SHELL_URLS = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));

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
  if (!isCode && !SHELL_URLS.has(url.origin + url.pathname)) return;
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
