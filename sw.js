/* Service worker: offline app shell.
 * The app shell (HTML/CSS/JS/icon and the PDF/QR libraries) is precached so
 * the app, ticket import and above all the stored tickets work with no
 * connection. Same-origin files are fetched network-first, so a new version
 * shows up on the next start; the cache is the fallback when offline.
 * Timetable API calls are network-only (live data, never served stale). */
const CACHE = 'sbb-light-v2';
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
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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

  event.respondWith(
    fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() =>
      caches.match(request, { ignoreSearch: true }).then((cached) =>
        cached || (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      )
    )
  );
});
