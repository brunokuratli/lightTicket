/* Service worker: offline app shell.
 * The app shell (HTML/CSS/JS/icon and the PDF/QR libraries) is precached so
 * the app, ticket import and above all the stored tickets work with no
 * connection. Same-origin files are fetched network-first (bypassing the HTTP
 * cache), so a new version shows up on the next start. If the network has not
 * answered within NET_TIMEOUT (weak signal on a train), the cached copy is
 * served at once and the network answer still refreshes the cache.
 * Timetable API calls are network-only (live data, never served stale). */
const CACHE = 'sbb-light-v2';
const NET_TIMEOUT = 2500; // ms
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './ticket-render.js',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './vendor/jsqr/jsQR.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Only the app's own files; timetable data and links go straight to the network.
  if (url.origin !== self.location.origin) return;

  const network = fetch(request, { cache: 'no-cache' }).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      return caches.open(CACHE).then((c) => c.put(request, copy)).then(() => res, () => res);
    }
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  const fromCache = () => caches.match(request, { ignoreSearch: true }).then((cached) =>
    cached || (request.mode === 'navigate' ? caches.match('./index.html') : undefined));

  event.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    // slow network: serve the cache after NET_TIMEOUT (if there is a copy)
    const timer = setTimeout(() => fromCache().then(finish), NET_TIMEOUT);
    network.then((res) => { clearTimeout(timer); finish(res); }, () => {
      clearTimeout(timer);
      fromCache().then((r) => finish(r || Response.error()));
    });
  }));
});
