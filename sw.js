/*
 * One-time cache recovery for older SCOREdash installations. Previous versions
 * used a cache-first app shell, which can keep an old design after a release.
 * This worker removes those caches and serves future requests from the network.
 */
const LEGACY_CACHE_PREFIX = "scoredash-";

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();

    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith(LEGACY_CACHE_PREFIX))
        .map(cacheName => caches.delete(cacheName))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});
