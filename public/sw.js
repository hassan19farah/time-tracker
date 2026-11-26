// Offline support. Pages: network first, so updates arrive as soon as you're online.
// Files (scripts, styles, icons): cache first; Vite gives them new names when they change.
// This only caches the app itself. Your entries live in IndexedDB, not here.
const CACHE = 'time-tracker-v1'
const SHELL = new URL('./', self.location).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const response = await fetch(SHELL, { cache: 'no-cache' })
      if (!response.ok) return
      const html = await response.clone().text()
      await cache.put(SHELL, response)
      // Pre-cache the files the page needs, so it works offline after the first visit.
      const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => new URL(m[1], SHELL))
        .filter((u) => u.origin === self.location.origin && u.href.startsWith(SHELL))
        .map((u) => u.href)
      await cache.addAll([...new Set(urls)])
    })(),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(SHELL)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (response.ok) (await caches.open(CACHE)).put(SHELL, response.clone())
          return response
        } catch {
          return (await caches.match(SHELL)) ?? Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
      return response
    })(),
  )
})
