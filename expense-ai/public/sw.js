const CACHE = 'splitkaro-v3'

// Static assets with content hashes — safe to cache aggressively
const STATIC_RE = /\/_next\/static\/|\/assets\/|\.ico$|\.png$|\.svg$|\.webmanifest$/

const PRECACHE = [
  '/offline.html',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/logo.svg',
]

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(PRECACHE).catch(() => {})
    )
  )
})

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Auth and API routes: always hit the network, never serve from cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  if (STATIC_RE.test(url.pathname)) {
    // Cache-first for hashed static assets
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()))
            return res
          })
      )
    )
  } else {
    // Network-first for navigation + dynamic pages.
    // Only serve the offline fallback when the device is genuinely offline
    // (navigator.onLine === false). If the server is simply unreachable (e.g.
    // self-signed cert on a LAN IP in dev), let the browser show its own error
    // so the offline page doesn't appear unexpectedly.
    event.respondWith(
      fetch(request).catch((err) => {
        if (!navigator.onLine) {
          return caches.match('/offline.html').then(
            (r) => r ?? new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          )
        }
        throw err
      })
    )
  }
})
