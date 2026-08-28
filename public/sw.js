const VERSION = 'raw-bench-v3';
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;
const SHELL = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/assets/icon.svg', '/assets/icon-192.png', '/assets/icon-512.png', '/assets/inspection-console.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ASSET_CACHE).then(async (cache) => {
    await cache.addAll(SHELL);
    const indexResponse = await fetch('/index.html', { cache: 'no-store' });
    const markup = await indexResponse.clone().text();
    const builtAssets = [...markup.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    await cache.put('/index.html', indexResponse);
    await cache.addAll(builtAssets);
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![ASSET_CACHE, PAGE_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  const path = new URL(event.request.url).pathname;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone(); caches.open(PAGE_CACHE).then((cache) => cache.put(event.request, copy)); return response;
    }).catch(async () => (await caches.match(path)) || (await caches.match('/index.html')) || caches.match('/offline.html')));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(path);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) { const copy = response.clone(); caches.open(ASSET_CACHE).then((cache) => cache.put(path, copy)); }
    return response;
  })());
});
