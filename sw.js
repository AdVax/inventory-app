/**
 * sw.js — Service Worker (PWA)
 * ──────────────────────────────────────────────────────────────
 * يوفر:
 * - Cache للأصول الثابتة (HTML, CSS, JS)
 * - Network-first للطلبات الديناميكية (Supabase)
 * - رسالة عند عدم الاتصال
 * ──────────────────────────────────────────────────────────────
 */

const CACHE_NAME    = 'inventory-erp-v2'
const STATIC_ASSETS = [
  '/inventory-app/',
  '/inventory-app//index.html',
  '/inventory-app//assets/css/main.css',
  '/inventory-app//src/main.js',
  '/inventory-app//src/config/supabase.js',
  '/inventory-app//src/store/store.js',
  '/inventory-app//src/router/router.js',
  '/inventory-app//src/utils/security.js',
  '/inventory-app//src/utils/formatters.js',
  '/inventory-app//src/utils/validators.js',
  '/inventory-app//src/components/toast.js',
  '/inventory-app//src/components/modal.js',
  '/inventory-app//src/components/spinner.js',
  '/inventory-app//src/components/confirmDialog.js',
]

// ── Install: تخزين الأصول الثابتة ──────────────────────────
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

// ── Activate: حذف الـ Cache القديم ─────────────────────────
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

// ── Fetch: استراتيجية التخزين ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // طلبات Supabase — Network First (أحدث بيانات دائماً)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache الاستجابات الناجحة فقط
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

  // طلبات Google Fonts — Cache First
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
          // إذا كان الطلب لـ HTML وغير متصل، أعد الصفحة الرئيسية
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html')
          }
        })
      })
    )
  }
})
