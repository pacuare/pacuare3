const CACHE_NAME = 'pacuare-static-v1'
const PRECACHE_URLS = [
  '/favicon.svg',
  '/logo.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Only the static, unauthenticated assets above are cached. Pages, actions, and the
// notebook proxy are session-scoped and dynamic, so they always go straight to the network.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  let url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !PRECACHE_URLS.includes(url.pathname)) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok) {
          let clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    }),
  )
})
