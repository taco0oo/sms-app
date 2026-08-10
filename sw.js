// Bump this string any time you want to force old cached files out.
// (Not strictly required with the network-first strategy below, but
// handy as a manual "flush everything" switch if things ever feel stale.)
const CACHE_NAME = 'sms-app-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Cache the app shell on install so the app can still open offline.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // activate the new SW as soon as it's installed
});

// Clean up old cache versions on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // take control of open tabs immediately
});

// NETWORK-FIRST for everything: always try to fetch the latest version
// from the network first (so your edits show up right away), and only
// fall back to the cached copy if the network request fails (offline).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
