// This worker keeps NOTHING: no page, no style sheet, no script. It exists
// only so that a visit always asks the server for the current page (GitHub
// Pages would otherwise let the browser reuse a page for 10 minutes), and so
// that a new version can take over tabs that still show an older one.
// Earlier versions stored the page and its files; a phone could then keep
// showing an old version. The name below is only a version marker: an empty
// cache, so the next version can tell that it replaces an older one.
const CACHE = 'v172';

// nothing to download, so installing cannot fail
self.addEventListener('install', e => { e.waitUntil(self.skipWaiting()); });

// Delete every cache older versions left behind, take over the open pages,
// and reload the ones an older version drew. A first visit has nothing older,
// so it is never reloaded.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => {
    const old = keys.filter(k => k !== CACHE);
    return Promise.all(old.map(k => caches.delete(k)))
      .then(() => caches.open(CACHE))
      .then(() => self.clients.claim())
      .then(() => old.length ? self.clients.matchAll({ type: 'window' }) : [])
      // not waited for: the reload's own request is held until this activation has finished
      .then(list => { list.forEach(c => { c.navigate(c.url).catch(() => {}); }); });
  }));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Pages only: ask the server every time (an unchanged page is a small 304).
  // Everything else goes straight to the browser; versioned files (?v=) are
  // safe in its own cache.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    let fresh = e.request;
    try { fresh = new Request(e.request, { cache: 'no-cache' }); } catch (err) { /* an engine that refuses: the plain request */ }
    e.respondWith(fetch(fresh).catch(() => fetch(e.request)));
  }
});
