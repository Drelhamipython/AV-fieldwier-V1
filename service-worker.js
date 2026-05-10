const CACHE = 'av-field-cloud-v5-32-import-center';
const ASSETS = ['.', 'index.html', 'styles.css', 'app.js', 'manifest.json', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png', 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => cached)));
});
