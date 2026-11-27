// Offline-ready Service Worker for the Satyanarayan Jewellers Owner PWA (/owner/).
// Scoped independently to ./ so the Owner PWA installs side-by-side with the customer
// Price Desk PWA without interfering with customer caching or live GitHub API calls.
const CACHE = 'sj-owner-desk-v3';
const SHELL = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

function isCacheable(res) {
  return Boolean(res && res.ok && res.type === 'basic');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('sj-owner-desk-') && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Live catalogue manifest: always hit network first so newly published items appear immediately;
  // fall back to last good cached manifest when offline so the owner can still inspect inventory.
  if (url.pathname.endsWith('/catalog/products.json') || url.pathname === '/catalog/products.json') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((cached) => cached || new Response('[]', { headers: { 'content-type': 'application/json' } })))
    );
    return;
  }

  // Statutory duty & GST policy: network-first with cached fallback offline so a duty update is
  // never masked by stale-while-revalidate.
  if (url.pathname.endsWith('/catalog/statutory-rates.json') || url.pathname === '/catalog/statutory-rates.json') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then((cached) => cached || Response.error()))
    );
    return;
  }

  // Keep Owner manifest.webmanifest network-first so updated PWA id/scope/icons reach phones immediately.
  if (url.pathname.endsWith('/manifest.webmanifest') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./manifest.webmanifest', copy));
          }
          return res;
        })
        .catch(() => caches.match('./manifest.webmanifest').then((cached) => cached || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Navigations inside the Owner PWA: network-first so updates arrive right away, offline fallback
  // to cached owner shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
            return res;
          }
          return caches.match('./index.html').then((cached) => cached || res);
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // Static same-origin assets (owner shell + published catalogue media): stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || new Response('Offline', { status: 503 }));
      return cached || networkFetch;
    })
  );
});
