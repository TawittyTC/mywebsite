const CACHE = 'v165';
const PRECACHE = [
  'assets/css/style.min.css?v=2.70.0',
  'assets/fonts/inter-latin.woff2',
  'assets/fonts/notosansthai-thai.woff2',
  'assets/fonts/notosansthai-latin.woff2',
  'assets/js/main.min.js?v=2.70.0',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  // HTML/navigations: network-first so deploys reach returning visitors
  // immediately; fall back to cache when offline. GitHub Pages lets the
  // browser keep a page for 10 minutes, so a plain visit right after a
  // deploy still got the old page from the browser's own cache: ask the
  // server every time instead (an unchanged page is a small 304).
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    let fresh = e.request;
    try { fresh = new Request(e.request, { cache: 'no-cache' }); } catch (err) { /* an engine that refuses: as before */ }
    e.respondWith(
      fetch(fresh).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Versioned static assets: cache-first (the ?v= query busts them)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
