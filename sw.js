// Minimal offline-shell service worker for Satyanarayan Jewellers Price Desk.
// Caches the static app shell with cache-poisoning guards; live market APIs and
// catalog/products.json always hit the network so visitors see fresh rates and items.
const CACHE = 'sj-price-desk-v11';
const SHELL = ['./index.html', './manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

function isCacheable(res) {
  return Boolean(res && res.ok && res.type === 'basic');
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Always fetch live catalogue manifest from network so newly published jewellery appears immediately.
  if (url.pathname.endsWith('/catalog/products.json') || url.pathname === '/catalog/products.json') {
    event.respondWith(
      fetch(req).catch(() => new Response('[]', { headers: { 'content-type': 'application/json' } }))
    );
    return;
  }

  // Statutory duty/GST is policy data: a stale cached copy would misprice every rupee figure, so
  // it always goes to the network and only a previously good cached copy may stand in offline.
  if (url.pathname.endsWith('/catalog/statutory-rates.json') || url.pathname === '/catalog/statutory-rates.json') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || Response.error()))
    );
    return;
  }

  // Always try the network first for navigations so users get fresh HTML when online.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put('./index.html', copy));
            return res;
          }
          return caches.match('./index.html').then(cached => cached || res);
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static same-origin assets: stale-while-revalidate with strict cacheability checks.
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req)
        .then(res => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
