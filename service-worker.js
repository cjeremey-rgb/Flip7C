const CACHE_NAME='flip-rush-7-v2026-09-06-visible-only-pregame-music-v37';
const APP_SHELL = [
  './',
  './index.html',
  './offline.html',
  './Flip-Rush-7-Single-Player.html',
  './online.html',
  './online.css',
  './winner-burst-frame.webp',
  './online.js',
  './avatar-reactions.css',
  './avatar-reactions.js',
  './screen-effects.js',
  './pregame-music.js',
  './neon-circuit.mp3',
  './frost-whiteout.webp',
  './freeze-sfx.mp3',
  './bust-sfx.mp3',
  './flip3-sfx.mp3',
  './second-chance-sfx.mp3',
  './hold-sfx.mp3',
  './flip7-sfx.mp3',
  './winner-sfx.mp3',
  './bust-approved-exact.webp',
  './second-chance-guardian-approved.webp',
  './avatar-1.webp',
  './avatar-2.webp',
  './avatar-3.webp',
  './avatar-4.webp',
  './avatar-5.webp',
  './avatar-6.webp',
  './avatar-7.webp',
  './avatar-8.webp',
  './avatar-9.webp',
  './avatar-10.webp',
  './avatar-1-excited.webp',
  './avatar-1-angry.webp',
  './avatar-1-shocked.webp',
  './avatar-2-excited.webp',
  './avatar-2-angry.webp',
  './avatar-2-shocked.webp',
  './avatar-3-excited.webp',
  './avatar-3-angry.webp',
  './avatar-3-shocked.webp',
  './avatar-4-excited.webp',
  './avatar-4-angry.webp',
  './avatar-4-shocked.webp',
  './avatar-5-excited.webp',
  './avatar-5-angry.webp',
  './avatar-5-shocked.webp',
  './avatar-6-excited.webp',
  './avatar-6-angry.webp',
  './avatar-6-shocked.webp',
  './avatar-7-excited.webp',
  './avatar-7-angry.webp',
  './avatar-7-shocked.webp',
  './avatar-8-excited.webp',
  './avatar-8-angry.webp',
  './avatar-8-shocked.webp',
  './avatar-9-excited.webp',
  './avatar-9-angry.webp',
  './avatar-9-shocked.webp',
  './avatar-10-excited.webp',
  './avatar-10-angry.webp',
  './avatar-10-shocked.webp',
  './avatar-nova.webp',
  './avatar-nova-excited.webp',
  './avatar-nova-angry.webp',
  './avatar-nova-shocked.webp',
  './avatar-ace.webp',
  './avatar-ace-excited.webp',
  './avatar-ace-angry.webp',
  './avatar-ace-shocked.webp',
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
