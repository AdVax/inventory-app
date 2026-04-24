/**
 * sw.js — Service Worker (PWA)
 */

const CACHE_NAME    = 'inventory-erp-v4'
const BASE          = '/inventory-app'
const STATIC_ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/assets/css/main.css`,
  `${BASE}/src/main.js`,
  `${BASE}/src/config/supabase.js`,
  `${BASE}/src/store/store.js`,
  `${BASE}/src/router/router.js`,
  `${BASE}/src/utils/security.js`,
  `${BASE}/src/utils/formatters.js`,
  `${BASE}/src/utils/validators.js`,
  `${BASE}/src/components/toast.js`,
  `${BASE}/src/components/modal.js`,
  `${BASE}/src/components/spinner.js`,
  `${BASE}/src/components/confirmDialog.js`,
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // نتجاهل أخطاء التخزين — التطبيق يعمل بدون Cache
      })
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // طلبات Supabase — Network First
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Google Fonts — Cache First
  if (url.hostname.includes('fonts.g')) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ?? fetch(event.request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
          return response
        })
      )
    )
    return
  }

  // الأصول المحلية — Cache First مع Network Fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone))
          }
          return response
        }).catch(() => {
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match(`${BASE}/index.html`)
          }
        })
      })
    )
  }
})
