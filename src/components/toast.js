/**
 * src/components/toast.js
 * ──────────────────────────────────────────────────────────────
 * 🔔 نظام الإشعارات (Toast Notifications)
 *
 * بديل react-hot-toast بالـ Vanilla JS.
 * يعرض إشعارات في أسفل الشاشة مع:
 * - 4 أنواع: success / error / warning / info
 * - اختفاء تلقائي بعد مدة محددة
 * - دعم الإغلاق اليدوي
 * - قائمة انتظار (لا تظهر أكثر من 3 في آن واحد)
 * - دعم كامل للـ Accessibility (aria-live)
 * ──────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
// ⚙️ الإعدادات
// ══════════════════════════════════════════════════════════════
const CONFIG = {
  MAX_VISIBLE:   3,           // أقصى عدد مرئي في آن واحد
  DEFAULT_DURATION: 4000,     // 4 ثواني
  ERROR_DURATION:   6000,     // الأخطاء تبقى أطول
  ANIMATION_MS:     250,      // مدة أنيميشن الاختفاء
}

// قائمة الإشعارات النشطة
let activeToasts = []

// ══════════════════════════════════════════════════════════════
// 🎨 أيقونات الإشعارات
// ══════════════════════════════════════════════════════════════
const ICONS = {
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
}

const CLOSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

// ══════════════════════════════════════════════════════════════
// 🏗️ إنشاء الـ Toast
// ══════════════════════════════════════════════════════════════

/**
 * الدالة الرئيسية لعرض الإشعار
 *
 * @param {string} message   - نص الإشعار
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {object} [options]
 * @param {number}  [options.duration]  - مدة العرض بالـ ms (0 = لا يختفي)
 * @param {string}  [options.title]     - عنوان اختياري
 * @returns {string} id الإشعار (للإغلاق اليدوي)
 */
function show(message, type = 'info', options = {}) {
  const container = document.getElementById('toast-container')
  if (!container) return ''

  // حذف أقدم إشعار إذا وصلنا للحد الأقصى
  if (activeToasts.length >= CONFIG.MAX_VISIBLE) {
    const oldest = activeToasts[0]
    if (oldest) dismiss(oldest.id)
  }

  const id       = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const duration = options.duration !== undefined
    ? options.duration
    : type === 'error' ? CONFIG.ERROR_DURATION : CONFIG.DEFAULT_DURATION

  // ── إنشاء عنصر الـ Toast ───────────────────────────────────
  const el = document.createElement('div')
  el.id          = id
  el.className   = `toast toast-${type}`
  el.setAttribute('role', type === 'error' ? 'alert' : 'status')
  el.setAttribute('aria-atomic', 'true')

  // المحتوى الداخلي
  el.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${ICONS[type] ?? ICONS.info}</span>
    <div style="flex:1; min-width:0;">
      ${options.title
        ? `<p style="font-weight:700; font-size:0.8125rem; margin-bottom:2px;">${escapeForToast(options.title)}</p>`
        : ''
      }
      <p style="font-size:0.8125rem; line-height:1.4; word-break:break-word;">${escapeForToast(message)}</p>
    </div>
    <button
      class="toast-close-btn"
      aria-label="إغلاق الإشعار"
      style="
        background:none; border:none; cursor:pointer;
        color:inherit; opacity:0.7; padding:2px;
        display:flex; align-items:center; flex-shrink:0;
        border-radius:4px; transition:opacity 0.15s;
      "
    >${CLOSE_ICON}</button>
  `

  // زر الإغلاق
  el.querySelector('.toast-close-btn')?.addEventListener('click', () => dismiss(id))

  // إيقاف مؤقت عند hover
  let timeoutId
  el.addEventListener('mouseenter', () => clearTimeout(timeoutId))
  el.addEventListener('mouseleave', () => {
    if (duration > 0) {
      timeoutId = setTimeout(() => dismiss(id), 1500)
    }
  })

  // إضافة للـ Container
  container.appendChild(el)
  activeToasts.push({ id, el })

  // الاختفاء التلقائي
  if (duration > 0) {
    timeoutId = setTimeout(() => dismiss(id), duration)
  }

  return id
}

/**
 * إخفاء إشعار بمعرّفه
 * @param {string} id
 */
function dismiss(id) {
  const idx = activeToasts.findIndex(t => t.id === id)
  if (idx === -1) return

  const { el } = activeToasts[idx]
  activeToasts.splice(idx, 1)

  // أنيميشن الاختفاء
  el.classList.add('toast-exit')
  setTimeout(() => el.remove(), CONFIG.ANIMATION_MS)
}

/**
 * إخفاء كل الإشعارات
 */
function dismissAll() {
  const ids = activeToasts.map(t => t.id)
  ids.forEach(dismiss)
}

// ══════════════════════════════════════════════════════════════
// 🔒 تعقيم النص — منع XSS داخل الإشعارات
// ══════════════════════════════════════════════════════════════
function escapeForToast(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
}

// ══════════════════════════════════════════════════════════════
// 📤 API المصدّرة
// ══════════════════════════════════════════════════════════════
export const toast = {
  /** إشعار نجاح ✅ */
  success: (message, options = {}) => show(message, 'success', options),

  /** إشعار خطأ ❌ */
  error: (message, options = {}) => show(message, 'error', options),

  /** إشعار تحذير ⚠️ */
  warning: (message, options = {}) => show(message, 'warning', options),

  /** إشعار معلومات ℹ️ */
  info: (message, options = {}) => show(message, 'info', options),

  /** إغلاق إشعار محدد */
  dismiss,

  /** إغلاق كل الإشعارات */
  dismissAll,

  /**
   * إشعار وعد (Promise Toast)
   * يعرض "جاري التحميل..." ثم يغيّره لنجاح/خطأ
   *
   * @param {Promise} promise
   * @param {{ loading, success, error }} messages
   * @returns {Promise}
   */
  async promise(promise, messages = {}) {
    const loadingId = show(
      messages.loading ?? 'جاري التنفيذ...',
      'info',
      { duration: 0 }
    )

    try {
      const result = await promise
      dismiss(loadingId)
      show(messages.success ?? 'تمت العملية بنجاح', 'success')
      return result
    } catch (error) {
      dismiss(loadingId)
      const errMsg = messages.error
        ?? error?.message
        ?? 'حدث خطأ في العملية'
      show(errMsg, 'error')
      throw error
    }
  },
}

export default toast
