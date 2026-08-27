const CACHE_NAME='flip-rush-7-v2026-08-27-score-route-fix'';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './Flip-Rush-7-Single-Player.html',
  './online.html',
  './online.css',
  './online.js',
  './manifest.json',
  './pwa-register.js',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Multiplayer state and actions must always come from the live server.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Do not interfere with third-party resources such as Google Fonts.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      // Network-first keeps installed phones on the newest GitHub/hosted build.
      const fresh = await fetch(request, { cache: 'no-store' });
      if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
      return fresh;
    } catch (error) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      throw error;
    }
  })());
});
