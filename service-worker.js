const CACHE_NAME = 'fis-shaft-rec-layout-v3';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=8.1-layout-v3',
  './app.js?v=8.1-layout-v3',
  './data.js?v=8.1-layout-v3',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => key === CACHE_NAME ? null : caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => caches.match('./index.html'))));
});

// Layout refinement v2: renamed to Shaft Recommendation Tool and top selector workflow.

// Layout V3: sticky shaft/head/intent selector bands above full-width recommendations.
