'use strict';
// Service worker: działanie bez sieci. Najpierw sieć (zawsze najnowsza wersja), a gdy jej brak – kopia z pamięci.
const CACHE = 'krag-v6';
const CORE = ['./', 'index.html', 'style.css', 'js/data.js', 'js/game.js', 'js/dial.js', 'js/sound.js', 'js/haptics.js', 'js/net.js', 'js/remote.js', 'js/app.js', 'tv.html', 'tv.css', 'js/tv.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/baloo2-latin.woff2', 'fonts/baloo2-latin-ext.woff2', 'fonts/nunito-latin.woff2', 'fonts/nunito-latin-ext.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))));
});
