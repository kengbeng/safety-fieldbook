/* Increment this version whenever any app-shell asset changes. */
const VERSION = 'v1.2.2-2026-11-11';
const SCOPE = self.registration.scope;
const CACHE_PREFIX = `safety-fieldbook:${new URL(SCOPE).pathname}:`;
const CACHE_NAME = CACHE_PREFIX + VERSION;
const SHELL = ['index.html', 'style.css', 'app.js', 'storage.js', 'export.js', 'photo-data.js',
  'tutorial.js', 'help.html', 'help.js', 'help-popup.js', 'camera.js', 'photo-entry.js', 'pwa.js', 'voice.js', 'findings.js', 'manifest.webmanifest', 'icon-rounded-192.png', 'icon-rounded-512.png',
  'icon-maskable-512.png', 'apple-touch-icon.png'];
const SHELL_URLS = SHELL.map(path => new URL(path, SCOPE).href);
self.addEventListener('install', event => {
  // Atomic population: a partial download must never claim offline readiness.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    SHELL_URLS.map(url => new Request(url, {cache: 'reload'}))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) || key.startsWith(`fieldbook-local-asr:${new URL(SCOPE).pathname}:`))
      .map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({type: 'window'});
    for (const client of clients) client.postMessage({type: 'OFFLINE_READY'});
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if(event.data?.type==='STATUS'&&event.ports?.[0])event.waitUntil((async()=>{const windows=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>client.url.startsWith(SCOPE)&&client.frameType!=='nested').length;event.ports[0].postMessage({windows});})());
});
self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || !url.href.startsWith(SCOPE)) return;
  const isAppNavigation = request.mode === 'navigate' &&
    (url.pathname === new URL(SCOPE).pathname ||
     url.pathname === new URL('index.html', SCOPE).pathname);
  const assetURL = new URL(url.pathname, url.origin).href;
  if (!isAppNavigation && !SHELL_URLS.includes(assetURL)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(isAppNavigation ? new URL('index.html', SCOPE).href : assetURL);
    return cached || fetch(request);
  })());
});
