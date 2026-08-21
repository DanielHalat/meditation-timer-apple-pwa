const CACHE_NAME = 'meditation-timer-pwa-v4';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './domain.js',
  './storage.js',
  './timer-engine.js',
  './manifest.webmanifest',
  './assets/Nunito-VariableFont_wght.ttf',
  './assets/brush_icon.png',
  './assets/timer_start_icon.svg',
  './assets/timer_pause_icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/gong1.wav',
  './assets/gong2.wav',
  './assets/gong3.wav',
  './assets/gong4.wav',
  './assets/preset-editor/ambient.svg',
  './assets/preset-editor/chevron_right.svg',
  './assets/preset-editor/drag_handle.svg',
  './assets/preset-editor/minus.svg',
  './assets/preset-editor/play.svg',
  './assets/preset-editor/plus.svg',
  './assets/preset-editor/remove.svg',
  './assets/preset-editor/selected.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html'))),
  );
});
