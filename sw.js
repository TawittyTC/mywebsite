const CACHE = 'v171';
const PRECACHE = [
  'assets/css/style.min.css?v=2.76.0',
  'assets/fonts/inter-latin.woff2',
  'assets/fonts/notosansthai-thai.woff2',
  'assets/fonts/notosansthai-latin.woff2',
  'assets/js/main.min.js?v=2.76.0',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

// A new version: drop every older cache, take over the open pages, and reload
// the ones that were drawn by the older version (a tab left open, or a page
// Safari restored from memory, would otherwise keep showing the old site).
// A first visit has no older cache, so it is never reloaded.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => {
    const old = keys.filter(k => k !== CACHE);
    return Promise.all(old.map(k => caches.delete(k)))
      .then(() => self.clients.claim())
      .then(() => old.length ? self.clients.matchAll({ type: 'window' }) : [])
      // not waited for: the reload's own request is held until this activation has finished
      .then(list => { list.forEach(c => { c.navigate(c.url).catch(() => {}); }); });
  }));
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
      }).catch(() => fresh === e.request ? caches.match(e.request)
        // the no-cache copy failed (an engine quirk, not the network): try the plain request before the stored page
        : fetch(e.request).catch(() => caches.match(e.request)))
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
