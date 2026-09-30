// Dessert OS service worker.
//
// Scope, deliberately: this only gives the app an installable, resilient
// shell (spec §42/§43). It is NOT a background-sync engine — per spec §43,
// "do not create a complicated offline synchronization system for V1."
// Writes made while offline are handled in the UI layer (a friendly
// "You're offline, this will save when your connection returns" message),
// not queued and replayed by this worker.

const CACHE_VERSION = 'dessert-os-v3' // bump whenever a cached icon changes
const APP_SHELL_URLS = [
  '/manifest.json',
  '/icons/iconAdik192x192.png',
  '/icons/iconAdik512x512.png',
  '/icons/iconAdik-192x192-maskable.png',
  '/icons/iconAdik-512x512-maskable.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL_URLS)).catch(() => {
      // Never fail install over a caching hiccup — the app must still work.
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

// Network-first for navigations and API calls (Supabase data must always be
// fresh when online); cache-first for the static app-shell assets above.
// Anything not explicitly handled just falls through to the network as
// normal, so this never interferes with Supabase auth or data requests.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isAppShellAsset = APP_SHELL_URLS.includes(url.pathname)

  if (isAppShellAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(
          (cached) =>
            cached ||
            new Response(
              '<!doctype html><title>Offline</title><body style="font-family:sans-serif;padding:2rem">You\'re offline. Previously loaded pages may still work — reconnect to continue.</body>',
              { headers: { 'Content-Type': 'text/html' } }
            )
        )
      )
    )
  }
})

// ---------------------------------------------------------------------------
// Phone notifications (web push). The server sends JSON:
//   { title, body, url, tag }   — see src/lib/notifications/messages.ts
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Adik Akak Bite'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/iconAdik192x192.png',
      badge: '/icons/iconAdik192x192.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/today' },
    })
  )
})

// Tapping a notification focuses an open app window (navigating it to the
// relevant page) or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/today', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.focus().then((focused) => (focused && 'navigate' in focused ? focused.navigate(target) : focused))
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
