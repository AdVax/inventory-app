/**
 * src/router/router.js
 * ──────────────────────────────────────────────────────────────
 * 🗺️ نظام التوجيه للـ SPA (Single Page Application)
 *
 * يعمل بنظام Hash-based routing:
 *   https://site.com/#/dashboard
 *   https://site.com/#/materials
 *   https://site.com/#/settings
 *
 * لماذا Hash Routing؟
 *   ✅ يعمل على GitHub Pages بدون إعداد إضافي
 *   ✅ لا يحتاج إعداد إعادة توجيه (redirect rules)
 *   ✅ لا حاجة لـ 404.html fallback معقدة
 *   ✅ يعمل محلياً بفتح الملف مباشرة (file://)
 *
 * ──────────────────────────────────────────────────────────────
 * 🔐 الحماية:
 *
 * 1. كل مسار له "guard" يُفحص قبل عرض الصفحة.
 * 2. المسارات المحمية تتحقق من الجلسة الحقيقية (Supabase).
 * 3. حتى لو غيّر المستخدم الـ hash يدوياً في الـ URL،
 *    سيُعاد توجيهه لصفحة الدخول إذا لم تكن جلسته صالحة.
 * 4. مسار الإعدادات محمي إضافياً للـ Admin فقط.
 * ──────────────────────────────────────────────────────────────
 */

import { store, setCurrentPage, toggleSidebar } from '../store/store.js'
import { getSession } from '../config/supabase.js'

// ══════════════════════════════════════════════════════════════
// 📋 تعريف المسارات
// ══════════════════════════════════════════════════════════════
const ROUTES = {

  // ─── صفحة تسجيل الدخول ────────────────────────────────────
  '/login': {
    page:  'login',
    title: 'تسجيل الدخول',
    guard: 'public',   // عام — لا يتطلب تسجيل دخول
  },

  // ─── لوحة القيادة ─────────────────────────────────────────
  '/dashboard': {
    page:  'dashboard',
    title: 'لوحة القيادة',
    guard: 'auth',     // يتطلب تسجيل دخول
  },

  // ─── المواد والمخزون ──────────────────────────────────────
  '/materials': {
    page:  'materials',
    title: 'المواد والمخزون',
    guard: 'auth',
  },

  // ─── سجل الحركات ──────────────────────────────────────────
  '/transactions': {
    page:  'transactions',
    title: 'سجل الحركات',
    guard: 'auth',
  },

  // ─── التقارير ─────────────────────────────────────────────
  '/reports': {
    page:  'reports',
    title: 'التقارير',
    guard: 'auth',
  },

  // ─── الإعدادات (Admin فقط) ────────────────────────────────
  '/settings': {
    page:  'settings',
    title: 'الإعدادات',
    guard: 'admin',    // يتطلب دور admin
  },
}

// المسار الافتراضي عند الدخول
const DEFAULT_AUTH_ROUTE    = '/dashboard'
const DEFAULT_PUBLIC_ROUTE  = '/login'
const DEFAULT_UNKNOWN_ROUTE = '/dashboard'

// ══════════════════════════════════════════════════════════════
// 🛡️ Guards — التحقق من الصلاحية قبل عرض الصفحة
// ══════════════════════════════════════════════════════════════

/**
 * التحقق من الـ guard لمسار معين
 *
 * @param {'public'|'auth'|'admin'} guardType
 * @returns {Promise<{allowed: boolean, redirectTo: string|null}>}
 */
async function checkGuard(guardType) {

  // المسارات العامة — لا تحتاج تحقق
  if (guardType === 'public') {
    // إذا كان المستخدم مسجل دخول بالفعل، أعده للوحة القيادة
    const session = await getSession()
    if (session) {
      return { allowed: false, redirectTo: DEFAULT_AUTH_ROUTE }
    }
    return { allowed: true, redirectTo: null }
  }

  // المسارات المحمية — تتطلب جلسة صالحة
  if (guardType === 'auth' || guardType === 'admin') {

    // 1. التحقق من الجلسة الحقيقية في Supabase
    const session = await getSession()
    if (!session) {
      return { allowed: false, redirectTo: DEFAULT_PUBLIC_ROUTE }
    }

    // 2. التحقق من بيانات المستخدم في الـ store
    const user = store.getState('user')

    if (!user || !user.is_active) {
      return { allowed: false, redirectTo: DEFAULT_PUBLIC_ROUTE }
    }

    // 3. للمسارات المحمية بـ Admin فقط
    if (guardType === 'admin' && user.role !== 'admin') {
      // Viewer يُعاد توجيهه للوحة القيادة مع رسالة
      console.warn('🔒 Router: Admin route accessed by viewer — redirecting')
      return { allowed: false, redirectTo: DEFAULT_AUTH_ROUTE }
    }

    return { allowed: true, redirectTo: null }
  }

  // guard غير معروف — آمن بالرفض
  return { allowed: false, redirectTo: DEFAULT_PUBLIC_ROUTE }
}

// ══════════════════════════════════════════════════════════════
// 🗺️ Router الرئيسي
// ══════════════════════════════════════════════════════════════

// قاموس لحفظ دوال تنظيف الصفحات (Cleanup)
const pageCleanups = {}

/**
 * الانتقال لمسار معين
 *
 * @param {string} path - المسار (مثل: '/dashboard')
 * @param {boolean} [replace=false] - استبدال بدل إضافة في التاريخ
 */
export function navigate(path, replace = false) {
  const normalizedPath = normalizePath(path)

  if (replace) {
    window.location.replace(`#${normalizedPath}`)
  } else {
    window.location.hash = normalizedPath
  }
}

/**
 * الرجوع للصفحة السابقة
 */
export function goBack() {
  window.history.back()
}

/**
 * الحصول على المسار الحالي من الـ URL
 * @returns {string}
 */
export function getCurrentPath() {
  const hash = window.location.hash
  return normalizePath(hash.replace('#', '') || DEFAULT_AUTH_ROUTE)
}

/**
 * تطبيع المسار — إزالة slashes زائدة وتحويل للحروف الصغيرة
 * @param {string} path
 * @returns {string}
 */
function normalizePath(path) {
  if (!path || path === '/') return DEFAULT_AUTH_ROUTE
  // التأكد من أن المسار يبدأ بـ /
  const normalized = path.startsWith('/') ? path : `/${path}`
  // إزالة الـ trailing slash
  return normalized.replace(/\/$/, '') || '/'
}

// ══════════════════════════════════════════════════════════════
// 🔄 معالج التوجيه الرئيسي
// ══════════════════════════════════════════════════════════════

/**
 * معالجة تغيير المسار وعرض الصفحة المناسبة
 */
async function handleRouteChange() {
  const path  = getCurrentPath()
  const route = ROUTES[path]

  // ── تنظيف الصفحة السابقة ──────────────────────────────────
  const prevPage = store.getState('currentPage')
  if (pageCleanups[prevPage]) {
    try {
      pageCleanups[prevPage]()
      delete pageCleanups[prevPage]
    } catch (e) {
      console.warn('Cleanup error for page:', prevPage, e)
    }
  }

  // ── إغلاق الـ Sidebar على الموبايل عند التنقل ─────────────
  toggleSidebar(false)

  // ── مسار غير موجود ────────────────────────────────────────
  if (!route) {
    console.warn(`Router: Unknown path "${path}" → redirecting`)
    navigate(DEFAULT_UNKNOWN_ROUTE, true)
    return
  }

  // ── فحص الـ Guard ─────────────────────────────────────────
  showRouteLoading()

  const { allowed, redirectTo } = await checkGuard(route.guard)

  if (!allowed) {
    navigate(redirectTo, true)
    return
  }

  // ── تحديث الـ Store ───────────────────────────────────────
  setCurrentPage(route.page)

  // ── تحديث عنوان الصفحة ────────────────────────────────────
  const companyName = store.getState('companySettings')?.company_name ?? 'المخزون'
  document.title = `${route.title} — ${companyName}`

  // ── تحديث الـ Sidebar (تحديد الصفحة النشطة) ─────────────
  updateSidebarActiveState(route.page)

  // ── تحديث الـ Header ──────────────────────────────────────
  updateHeaderTitle(route.title)

  // ── عرض الصفحة ────────────────────────────────────────────
  await renderPage(route.page)

  // ── التمرير للأعلى ────────────────────────────────────────
  const pageContent = document.getElementById('page-content')
  if (pageContent) pageContent.scrollTop = 0
}

// ══════════════════════════════════════════════════════════════
// 🎨 عرض الصفحات
// ══════════════════════════════════════════════════════════════

/**
 * تحميل وعرض صفحة معينة
 * نستخدم Dynamic Import لتحميل الصفحة عند الحاجة فقط (Lazy Loading)
 *
 * @param {string} pageName
 */
async function renderPage(pageName) {
  const container = document.getElementById('page-content')
  if (!container) return

  // إظهار/إخفاء هيكل التطبيق حسب الصفحة
  const appShell    = document.getElementById('app')
  const appLoader   = document.getElementById('app-loader')

  if (pageName === 'login') {
    // صفحة الدخول — تعرض خارج الـ Shell
    if (appShell)  appShell.classList.add('hidden')
    if (appLoader) appLoader.classList.add('hidden')

    try {
      const { renderLoginPage } = await import('../pages/login/login.page.js')
      document.body.innerHTML = ''
      document.body.appendChild(createPageWrapper())
      await renderLoginPage(document.getElementById('page-root'))
    } catch (e) {
      console.error('Failed to load login page:', e)
      showPageError('فشل في تحميل صفحة الدخول')
    }
    return
  }

  // الصفحات الأخرى — تعرض داخل الـ Shell
  if (appLoader) appLoader.classList.add('hidden')
  if (appShell)  appShell.classList.remove('hidden')

  // محتوى داخل max-width wrapper
  const innerContainer = container.querySelector('.max-w-7xl') || container

  // إظهار مؤشر تحميل داخل الصفحة
  innerContainer.innerHTML = `
    <div class="loading-screen">
      <div class="spinner"></div>
      <p>جاري التحميل...</p>
    </div>
  `

  try {
    // Dynamic Import — تحميل الصفحة عند الحاجة
    const pageModule = await loadPageModule(pageName)

    if (pageModule && typeof pageModule.render === 'function') {
      // تخزين دالة التنظيف إذا وُجدت
      const cleanup = await pageModule.render(innerContainer)
      if (typeof cleanup === 'function') {
        pageCleanups[pageName] = cleanup
      }
    } else {
      showPageComingSoon(innerContainer, pageName)
    }
  } catch (e) {
    console.error(`Failed to load page "${pageName}":`, e)
    showPageError(`فشل في تحميل الصفحة`, innerContainer)
  }
}

/**
 * تحميل module الصفحة ديناميكياً
 * @param {string} pageName
 * @returns {Promise<object|null>}
 */
async function loadPageModule(pageName) {
  const PAGE_MODULES = {
    dashboard:    () => import('../pages/dashboard/dashboard.page.js'),
    materials:    () => import('../pages/materials/materials.page.js'),
    transactions: () => import('../pages/transactions/transactions.page.js'),
    reports:      () => import('../pages/reports/reports.page.js'),
    settings:     () => import('../pages/settings/settings.page.js'),
  }

  const loader = PAGE_MODULES[pageName]
  if (!loader) return null

  return await loader()
}

// ══════════════════════════════════════════════════════════════
// 🔧 دوال مساعدة للـ UI
// ══════════════════════════════════════════════════════════════

/** إظهار مؤشر تحميل أثناء فحص الـ Guard */
function showRouteLoading() {
  const container = document.getElementById('page-content')
  if (!container) return
  const inner = container.querySelector('.max-w-7xl') || container
  inner.innerHTML = `
    <div class="loading-screen">
      <div class="spinner"></div>
    </div>
  `
}

/** عرض خطأ تحميل الصفحة */
function showPageError(message, container = null) {
  const target = container || document.getElementById('page-content')
  if (!target) return
  target.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
      </div>
      <p class="empty-state-title">${message}</p>
      <p class="empty-state-text">يرجى تحديث الصفحة والمحاولة مرة أخرى</p>
      <button onclick="location.reload()" class="btn btn-secondary btn-sm" style="margin-top:1rem">
        تحديث الصفحة
      </button>
    </div>
  `
}

/** عرض "قريباً" للصفحات غير المكتملة */
function showPageComingSoon(container, pageName) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>
      <p class="empty-state-title">هذه الصفحة قيد الإنشاء</p>
      <p class="empty-state-text">${pageName}</p>
    </div>
  `
}

/** تحديث حالة الـ Sidebar (الرابط النشط) */
function updateSidebarActiveState(activePage) {
  document.querySelectorAll('.nav-item').forEach(item => {
    const page = item.dataset.page
    if (page === activePage) {
      item.classList.add('active')
      // إضافة نقطة المؤشر إذا لم تكن موجودة
      if (!item.querySelector('.nav-dot')) {
        const dot = document.createElement('span')
        dot.className = 'nav-dot'
        item.appendChild(dot)
      }
    } else {
      item.classList.remove('active')
      item.querySelector('.nav-dot')?.remove()
    }
  })
}

/** تحديث عنوان الـ Header */
function updateHeaderTitle(title) {
  const titleEl = document.getElementById('header-title')
  if (titleEl) titleEl.textContent = title
}

/** إنشاء wrapper بسيط لصفحة الدخول */
function createPageWrapper() {
  const div = document.createElement('div')
  div.id = 'page-root'
  return div
}

// ══════════════════════════════════════════════════════════════
// 🚀 تهيئة الـ Router
// ══════════════════════════════════════════════════════════════

/**
 * تفعيل الـ Router والاستماع لتغييرات الـ Hash
 * يُستدعى مرة واحدة فقط عند بدء التطبيق
 */
export function initRouter() {
  // الاستماع لتغيير الـ Hash
  window.addEventListener('hashchange', () => {
    handleRouteChange()
  })

  // معالجة المسار الحالي عند التحميل الأول
  // (إذا لم يكن هناك hash، التوجيه للافتراضي)
  if (!window.location.hash || window.location.hash === '#') {
    window.location.hash = DEFAULT_AUTH_ROUTE
  } else {
    handleRouteChange()
  }

  // الاستماع لتغييرات المستخدم من الـ store (تسجيل دخول/خروج)
  document.addEventListener('store:user', ({ detail }) => {
    const user        = detail.value
    const currentPath = getCurrentPath()
    const route       = ROUTES[currentPath]

    if (!user && route?.guard !== 'public') {
      // المستخدم سجّل خروج — أعده لتسجيل الدخول
      navigate(DEFAULT_PUBLIC_ROUTE, true)
    } else if (user && currentPath === '/login') {
      // المستخدم سجّل دخول — أعده للوحة القيادة
      navigate(DEFAULT_AUTH_ROUTE, true)
    }
  })

  // الاستماع لتغييرات إعدادات الشركة لتحديث عنوان الصفحة
  document.addEventListener('store:companySettings', () => {
    const route = ROUTES[getCurrentPath()]
    if (route) {
      const companyName = store.getState('companySettings')?.company_name ?? 'المخزون'
      document.title = `${route.title} — ${companyName}`
    }
  })
}

// ══════════════════════════════════════════════════════════════
// 📤 تصدير ثوابت المسارات للاستخدام في المكونات
// ══════════════════════════════════════════════════════════════
export const PAGES = {
  LOGIN:        '/login',
  DASHBOARD:    '/dashboard',
  MATERIALS:    '/materials',
  TRANSACTIONS: '/transactions',
  REPORTS:      '/reports',
  SETTINGS:     '/settings',
}

export { ROUTES }
