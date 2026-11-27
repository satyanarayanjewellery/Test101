// Minimal offline-shell service worker for Satyanarayan Jewellers Price Desk.
// Caches the static app shell with cache-poisoning guards; live market APIs and
// catalog/products.json always hit the network so visitors see fresh rates and items.
const CACHE = 'sj-price-desk-v12';
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
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && !key.startsWith('sj-owner-desk-')).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept the dedicated Owner PWA scope; owner/sw.js manages /owner/ independently.
  if (url.pathname.includes('/owner/') || url.pathname.endsWith('/owner')) return;

  // Always fetch live catalogue manifest from network so newly published jewellery appears immediately;
  // cache under pathname (stripping ?t= cache-buster) so offline visitors still see the last good catalog.
  if (url.pathname.endsWith('/catalog/products.json') || url.pathname === '/catalog/products.json') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then(cached => cached || new Response('[]', { headers: { 'content-type': 'application/json' } })))
    );
    return;
  }

  // Statutory duty/GST is policy data: a stale cached copy would misprice every rupee figure, so
  // it always goes to the network and only a previously good cached copy may stand in offline.
  // Cache under url.pathname (stripping ?t= cache-buster) to avoid polluting cache storage and to
  // guarantee offline fallback hits.
  if (url.pathname.endsWith('/catalog/statutory-rates.json') || url.pathname === '/catalog/statutory-rates.json') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() => caches.match(url.pathname).then(cached => cached || Response.error()))
    );
    return;
  }

  // Keep manifest.webmanifest network-first so updated PWA id/scope/icons reach phones immediately.
  if (url.pathname.endsWith('/manifest.webmanifest') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (isCacheable(res)) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put('./manifest.webmanifest', copy));
          }
          return res;
        })
        .catch(() => caches.match('./manifest.webmanifest').then(cached => cached || new Response('Offline', { status: 503 })))
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
        .catch(() => caches.match('./index.html').then(cached => cached || new Response('Offline', { status: 503 })))
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
        .catch(() => cached || new Response('Offline', { status: 503 }));
      return cached || networkFetch;
    })
  );
});
