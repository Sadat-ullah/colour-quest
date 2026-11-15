/* ─────────────────────────────────────────────────────────────
 *  sw.js – Service Worker for Colour Quest PWA
 *  Implements offline-first caching strategy:
 *  - Network-First with Cache Fallback for HTML/Navigation
 *  - Cache-First with Network Fallback for static assets
 * ───────────────────────────────────────────────────────────── */

const CACHE_NAME = 'colour-quest-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching partial failure:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Network-First for HTML/Navigation requests
  const isHtmlNavigation =
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.html');

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to cached index.html or root
          return (await caches.match('/index.html')) || (await caches.match('/'));
        })
    );
    return;
  }

  // Cache-First for assets (scripts, styles, audio, images, json data, fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          // Cache successful responses for same-origin or CORS
          if (
            networkResponse &&
            (networkResponse.status === 200 || networkResponse.type === 'opaque')
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          // Offline fallback if needed
          return cachedResponse;
        });
    })
  );
});
