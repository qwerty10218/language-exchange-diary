// Zero-dependency Service Worker for Language Exchange Diary PWA.
// Scope: /language-exchange-diary/
const CACHE_NAME = 'led-pwa-v1';
const SCOPE_BASE = self.registration.scope.endsWith('/')
  ? self.registration.scope
  : `${self.registration.scope}/`;
const CORE_URLS = [
  SCOPE_BASE,
  `${SCOPE_BASE}index.html`,
  `${SCOPE_BASE}manifest.webmanifest`,
  `${SCOPE_BASE}icons/icon.svg`,
  `${SCOPE_BASE}icons/icon-192.png`,
  `${SCOPE_BASE}icons/icon-512.png`,
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_URLS.map(url => cache.add(new Request(url, { cache: 'reload' })))),
    ),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('led-pwa-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.href.startsWith(SCOPE_BASE)) return;

  // Network-first for HTML navigations so deployed vocabulary updates show up promptly,
  // with full offline fallback to cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(`${SCOPE_BASE}index.html`, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(`${SCOPE_BASE}index.html`).then(hit => hit || caches.match(SCOPE_BASE))),
    );
    return;
  }

  // Stale-while-revalidate for JS, CSS, SVG stroke assets, icons and licenses.
  event.respondWith(
    caches.match(request).then(cached => {
      const fresh = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
