/**
 * src/main.js
 * ──────────────────────────────────────────────────────────────
 * 🚀 نقطة بدء التطبيق
 *
 * هذا الملف يقوم بـ Bootstrap الكامل للتطبيق:
 * 1. التحقق من الجلسة الحالية (Supabase)
 * 2. تحميل إعدادات الشركة وسعر الصرف
 * 3. بناء الـ Sidebar والـ Header
 * 4. تفعيل الـ Router
 * 5. إخفاء شاشة التحميل
 *
 * ملاحظة: هذا الملف لا يُنفّذ بشكل كامل حتى
 * يكتمل تطوير باقي الملفات. سيُحدَّث تدريجياً.
 * ──────────────────────────────────────────────────────────────
 */

import { supabase, getSession, handleSupabaseError } from './config/supabase.js'
import {
  store,
  setUser, clearUser, setAuthLoading,
  setCompanySettings, setLatestExchangeRate,
  toggleSidebar, selectIsAdmin, selectCompanyName,
} from './store/store.js'
import { initRouter, navigate, PAGES } from './router/router.js'
import { sanitize } from './utils/security.js'

// ══════════════════════════════════════════════════════════════
// 🎬 Bootstrap — تشغيل التطبيق
// ══════════════════════════════════════════════════════════════
async function bootstrap() {
  try {
    // ── 1. إخفاء شاشة التحميل الأولية بعد تحميل DOM ──────────
    // (شاشة التحميل الأولية في index.html تظهر حتى نحن جاهزون)

    // ── 2. التحقق من الجلسة الحقيقية ─────────────────────────
    setAuthLoading(true)

    const session = await getSession()

    if (session?.user) {
      // لديه جلسة — جلب بيانات الـ profile
      const profile = await fetchUserProfile(session.user.id)

      if (profile && profile.is_active) {
        setUser(profile)

        // جلب إعدادات الشركة وسعر الصرف في الخلفية
        loadAppSettings()
      } else {
        // الحساب موقوف أو غير موجود
        await supabase.auth.signOut()
        clearUser()
      }
    } else {
      // لا توجد جلسة
      setAuthLoading(false)
    }

    // ── 3. بناء هيكل التطبيق ──────────────────────────────────
    buildAppShell()

    // ── 4. الاستماع لتغييرات Auth ─────────────────────────────
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearUser()
        return
      }

      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        if (profile?.is_active) {
          setUser(profile)
          loadAppSettings()
        }
      }

      // TOKEN_REFRESHED — لا نحتاج إجراء
    })

    // ── 5. تفعيل الـ Router ────────────────────────────────────
    initRouter()

    // ── 6. إخفاء شاشة التحميل الأولية ─────────────────────────
    hideInitialLoader()

    // ── 7. تسجيل Service Worker ────────────────────────────────
    registerServiceWorker()

  } catch (error) {
    console.error('Bootstrap error:', error)
    showBootstrapError(error)
  }
}

// ══════════════════════════════════════════════════════════════
// 👤 جلب بيانات المستخدم
// ══════════════════════════════════════════════════════════════
async function fetchUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  } catch (e) {
    console.error('Failed to fetch user profile:', e)
    return null
  }
}

// ══════════════════════════════════════════════════════════════
// ⚙️ تحميل إعدادات التطبيق
// ══════════════════════════════════════════════════════════════
async function loadAppSettings() {
  // تشغيل الطلبين بالتوازي لسرعة أكبر
  await Promise.allSettled([
    loadCompanySettings(),
    loadLatestExchangeRate(),
  ])
}

async function loadCompanySettings() {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (!error && data) setCompanySettings(data)
  } catch (e) {
    console.warn('Could not load company settings:', e)
  }
}

async function loadLatestExchangeRate() {
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) setLatestExchangeRate(data)
  } catch (e) {
    console.warn('Could not load exchange rate:', e)
  }
}

// ══════════════════════════════════════════════════════════════
// 🏗️ بناء هيكل التطبيق (Shell)
// ══════════════════════════════════════════════════════════════
function buildAppShell() {
  buildSidebar()
  buildHeader()

  // الاستماع لتغييرات المستخدم لإعادة بناء الـ Shell
  store.subscribe('user', () => {
    buildSidebar()
    buildHeader()
  })

  // الاستماع لتغييرات الـ Sidebar
  store.subscribe('sidebarOpen', ({ value }) => {
    const sidebar  = document.getElementById('sidebar')
    const overlay  = document.getElementById('sidebar-overlay')

    if (value) {
      sidebar?.classList.remove('translate-x-full')
      overlay?.classList.remove('hidden')
    } else {
      sidebar?.classList.add('translate-x-full')
      overlay?.classList.add('hidden')
    }
  })

  // إغلاق Sidebar عند الضغط على الـ Overlay
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    toggleSidebar(false)
  })
}

// ── بناء الـ Sidebar ──────────────────────────────────────────
function buildSidebar() {
  const sidebar = document.getElementById('sidebar')
  if (!sidebar) return

  const user    = store.getState('user')
  const isAdmin = selectIsAdmin()

  // عناصر القائمة
  const navItems = [
    { page: '/dashboard',    label: 'لوحة القيادة',    icon: iconDashboard() },
    { page: '/materials',    label: 'المواد والمخزون',  icon: iconPackage()   },
    { page: '/transactions', label: 'الحركات',          icon: iconArrows()    },
    { page: '/reports',      label: 'التقارير',         icon: iconChart()     },
    ...(isAdmin ? [{ page: '/settings', label: 'الإعدادات', icon: iconSettings() }] : []),
  ]

  sidebar.innerHTML = `
    <!-- رأس الـ Sidebar -->
    <div class="flex items-center justify-between p-5 border-b border-slate-700/50">
      <div>
        <h2 class="text-sm font-bold text-slate-100 leading-tight">نظام المخزون</h2>
        <p class="text-xs text-slate-500 mt-0.5">إدارة محاسبية متكاملة</p>
      </div>
      <!-- زر الإغلاق (موبايل) -->
      <button
        id="sidebar-close-btn"
        class="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        aria-label="إغلاق القائمة"
      >
        ${iconX()}
      </button>
    </div>

    <!-- بطاقة المستخدم -->
    ${user ? `
      <div class="m-4 p-3 bg-slate-700/50 rounded-xl border border-slate-600/30">
        <div class="flex items-center gap-3">
          <!-- Avatar -->
          <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
            isAdmin
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }">
            ${sanitize(user.full_name?.charAt(0) ?? '؟')}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-200 truncate">${sanitize(user.full_name ?? '')}</p>
            <span class="badge ${isAdmin ? 'badge-admin' : 'badge-viewer'}" style="margin-top:2px">
              ${isAdmin
                ? `${iconShield()} مدير`
                : `${iconEye()} مشاهد`
              }
            </span>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- روابط التنقل -->
    <nav class="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
      ${navItems.map(item => `
        <a
          href="#${item.page}"
          class="nav-item"
          data-page="${item.page.replace('/', '')}"
          data-path="${item.page}"
          aria-label="${sanitize(item.label)}"
        >
          ${item.icon}
          <span>${sanitize(item.label)}</span>
        </a>
      `).join('')}
    </nav>

    <!-- Viewer Notice -->
    ${!isAdmin && user ? `
      <div class="mx-4 mb-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-400/70 text-center">
        وضع المشاهدة — لا يمكن التعديل
      </div>
    ` : ''}
  `

  // ربط زر الإغلاق
  document.getElementById('sidebar-close-btn')?.addEventListener('click', () => {
    toggleSidebar(false)
  })
}

// ── بناء الـ Header ───────────────────────────────────────────
function buildHeader() {
  const header = document.getElementById('main-header')
  if (!header) return

  header.innerHTML = `
    <!-- زر الـ Sidebar (موبايل) -->
    <button
      id="menu-btn"
      class="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
      aria-label="فتح القائمة"
    >
      ${iconMenu()}
    </button>

    <!-- عنوان الصفحة -->
    <h1 id="header-title" class="text-base font-semibold text-slate-200 flex-1">
      لوحة القيادة
    </h1>

    <!-- أدوات اليمين -->
    <div class="flex items-center gap-2">
      <!-- زر تسجيل الخروج -->
      <button
        id="logout-btn"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
               text-slate-400 hover:text-red-400 hover:bg-red-500/10
               border border-transparent hover:border-red-500/20
               transition-all duration-150"
        aria-label="تسجيل الخروج"
      >
        ${iconLogout()}
        <span class="hidden sm:inline text-xs">خروج</span>
      </button>
    </div>
  `

  // ربط زر القائمة
  document.getElementById('menu-btn')?.addEventListener('click', () => {
    toggleSidebar(true)
  })

  // ربط زر تسجيل الخروج
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout)
}

// ── تسجيل الخروج ──────────────────────────────────────────────
async function handleLogout() {
  const btn = document.getElementById('logout-btn')
  if (btn) btn.classList.add('opacity-50', 'pointer-events-none')

  try {
    await supabase.auth.signOut()
    clearUser()
    // navigate للـ login سيتم من الـ store:user listener في router
  } catch (e) {
    console.error('Logout error:', e)
    if (btn) btn.classList.remove('opacity-50', 'pointer-events-none')
  }
}

// ══════════════════════════════════════════════════════════════
// 🔧 دوال مساعدة
// ══════════════════════════════════════════════════════════════
function hideInitialLoader() {
  const loader = document.getElementById('app-loader')
  if (loader) {
    loader.style.transition = 'opacity 0.3s ease'
    loader.style.opacity = '0'
    setTimeout(() => loader.classList.add('hidden'), 300)
  }
}

function showBootstrapError(error) {
  hideInitialLoader()
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0f172a;display:flex;align-items:center;justify-content:center;font-family:Tajawal,sans-serif;direction:rtl;padding:2rem;">
      <div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:2rem;max-width:420px;text-align:center;">
        <p style="color:#f87171;font-size:1.1rem;font-weight:700;margin-bottom:0.75rem;">⚠️ خطأ في تشغيل التطبيق</p>
        <p style="color:#94a3b8;font-size:0.875rem;line-height:1.6;margin-bottom:1.25rem;">
          ${sanitize(handleSupabaseError(error))}
        </p>
        <button onclick="location.reload()"
          style="background:#2563eb;color:white;border:none;padding:0.5rem 1.5rem;border-radius:8px;cursor:pointer;font-family:inherit;font-size:0.875rem;">
          إعادة التحميل
        </button>
      </div>
    </div>
  `
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js')
    } catch {
      // Service Worker اختياري — لا نوقف التطبيق
    }
  }
}

// ══════════════════════════════════════════════════════════════
// 🎨 SVG Icons — مضمّنة لتجنب طلبات شبكة إضافية
// ══════════════════════════════════════════════════════════════
const SVG = (path, extra = '') =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`

const iconDashboard = () => SVG('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>')
const iconPackage   = () => SVG('<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>')
const iconArrows    = () => SVG('<path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>')
const iconChart     = () => SVG('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>')
const iconSettings  = () => SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>')
const iconX         = () => SVG('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')
const iconMenu      = () => SVG('<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>')
const iconLogout    = () => SVG('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')
const iconShield    = () => `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
const iconEye       = () => `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`

// ══════════════════════════════════════════════════════════════
// 🏁 تشغيل التطبيق
// ══════════════════════════════════════════════════════════════
// DOMContentLoaded مضمون لأن type="module" يعمل بعد تحميل DOM
bootstrap()
