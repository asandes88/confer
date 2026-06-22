// Confer service worker — offline app shell.
// Navigations: network-first (so redeploys are picked up), fall back to cache.
// Static assets: cache-first with background refresh (stale-while-revalidate).
// Cross-origin requests (e.g. the Anthropic API) and non-GET are passed straight through.
const CACHE = 'confer-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE)
        try {
          const fresh = await fetch(request)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          return (await cache.match(request)) || (await cache.match(self.registration.scope)) || Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(request)
      if (cached) {
        fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone())
          })
          .catch(() => {})
        return cached
      }
      try {
        const res = await fetch(request)
        if (res && res.status === 200) cache.put(request, res.clone())
        return res
      } catch {
        return cached || Response.error()
      }
    })(),
  )
})
