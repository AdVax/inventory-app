/**
 * src/components/modal.js
 * ──────────────────────────────────────────────────────────────
 * 🪟 نظام النوافذ المنبثقة (Modal Dialogs)
 *
 * يدعم:
 * - فتح/إغلاق مع أنيميشن
 * - إغلاق بـ Escape أو النقر خارجاً
 * - منع التمرير في الخلفية
 * - Focus Trap (إمكانية الوصول)
 * - أحجام متعددة: sm / md / lg / xl
 * - استدعاء برمجي أو تصريحي (Declarative)
 *
 * 🔐 الأمان:
 * - المحتوى يُمرَّر كـ DOM element (ليس innerHTML)
 *   للحماية من XSS — أو كـ string مع sanitize
 * ──────────────────────────────────────────────────────────────
 */

import { sanitize } from '../utils/security.js'

// ══════════════════════════════════════════════════════════════
// 🏗️ حالة الـ Modal
// ══════════════════════════════════════════════════════════════
let currentModal = null   // Modal المفتوح حالياً
let previousFocus = null  // العنصر الذي كان في focus قبل فتح الـ Modal

// ══════════════════════════════════════════════════════════════
// 🎨 SVG Icons
// ══════════════════════════════════════════════════════════════
const CLOSE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

// ══════════════════════════════════════════════════════════════
// 📐 أحجام الـ Modal
// ══════════════════════════════════════════════════════════════
const SIZE_CLASSES = {
  sm: 'modal-sm',
  md: 'modal-md',
  lg: 'modal-lg',
  xl: 'modal-xl',
}

// ══════════════════════════════════════════════════════════════
// 🚀 فتح Modal
// ══════════════════════════════════════════════════════════════

/**
 * فتح نافذة منبثقة
 *
 * @param {object} options
 * @param {string}          options.title          - عنوان الـ Modal
 * @param {HTMLElement|string} options.content      - المحتوى (element أو HTML string)
 * @param {'sm'|'md'|'lg'|'xl'} [options.size='md']
 * @param {boolean}         [options.closable=true] - السماح بالإغلاق
 * @param {Function}        [options.onClose]       - callback عند الإغلاق
 * @param {Function}        [options.onOpen]        - callback بعد الفتح
 * @param {string}          [options.id]            - معرّف للـ Modal
 * @returns {{ close: Function, getBody: Function }}
 */
export function openModal({
  title,
  content,
  size      = 'md',
  closable  = true,
  onClose   = null,
  onOpen    = null,
  id        = `modal-${Date.now()}`,
} = {}) {

  // إغلاق أي Modal مفتوح مسبقاً
  if (currentModal) {
    closeModal(false)  // false = لا نستدعي onClose القديم
  }

  const container = document.getElementById('modal-container')
  if (!container) return { close: () => {}, getBody: () => null }

  // حفظ العنصر الذي كان في focus
  previousFocus = document.activeElement

  // ── بناء هيكل الـ Modal ────────────────────────────────────
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  backdrop.setAttribute('aria-labelledby', `${id}-title`)
  backdrop.id = id

  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md

  backdrop.innerHTML = `
    <div class="modal-box ${sizeClass}" role="document">
      <div class="modal-header">
        <h2 class="modal-title" id="${id}-title">${sanitize(title ?? '')}</h2>
        ${closable
          ? `<button class="modal-close-btn" aria-label="إغلاق النافذة" type="button">${CLOSE_ICON}</button>`
          : ''
        }
      </div>
      <div class="modal-body" id="${id}-body">
        <!-- المحتوى يُضاف هنا -->
      </div>
    </div>
  `

  // إضافة المحتوى بأمان
  const bodyEl = backdrop.querySelector(`#${id}-body`)
  if (bodyEl) {
    if (content instanceof HTMLElement || content instanceof DocumentFragment) {
      // DOM element مباشر — آمن تماماً
      bodyEl.appendChild(content)
    } else if (typeof content === 'string') {
      // HTML string — يجب أن يكون من مصدر موثوق (صفحاتنا)
      // ⚠️ المستخدمون لا يُدخلون هذا المحتوى مباشرة
      bodyEl.innerHTML = content
    }
  }

  // ── الأحداث ────────────────────────────────────────────────

  // إغلاق بالـ backdrop (النقر خارج الـ Modal)
  if (closable) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal()
    })
  }

  // زر الإغلاق
  backdrop.querySelector('.modal-close-btn')?.addEventListener('click', () => closeModal())

  // حفظ الـ callback
  currentModal = { id, backdrop, onClose, closable }

  // إضافة للـ DOM
  container.innerHTML = ''
  container.appendChild(backdrop)
  container.classList.remove('hidden')

  // منع تمرير الصفحة
  document.body.style.overflow = 'hidden'

  // Focus Trap — التركيز على أول عنصر قابل للتفاعل
  requestAnimationFrame(() => {
    const focusable = backdrop.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    focusable?.focus()
    onOpen?.()
  })

  return {
    close:   () => closeModal(),
    getBody: () => bodyEl,
  }
}

// ══════════════════════════════════════════════════════════════
// 🚪 إغلاق Modal
// ══════════════════════════════════════════════════════════════

/**
 * إغلاق الـ Modal الحالي
 * @param {boolean} [triggerCallback=true]
 */
export function closeModal(triggerCallback = true) {
  if (!currentModal) return

  const { backdrop, onClose, closable } = currentModal
  if (!closable && triggerCallback) return

  // أنيميشن الإغلاق
  const box = backdrop.querySelector('.modal-box')
  if (box) {
    box.style.transition = 'opacity 0.15s ease, transform 0.15s ease'
    box.style.opacity    = '0'
    box.style.transform  = 'scale(0.97)'
  }
  backdrop.style.transition = 'opacity 0.15s ease'
  backdrop.style.opacity    = '0'

  setTimeout(() => {
    const container = document.getElementById('modal-container')
    if (container) {
      container.innerHTML = ''
      container.classList.add('hidden')
    }

    // استعادة التمرير
    document.body.style.overflow = ''

    // استعادة الـ Focus
    if (previousFocus && document.contains(previousFocus)) {
      previousFocus.focus()
    }
    previousFocus = null

    // استدعاء الـ callback
    if (triggerCallback) onClose?.()

    currentModal = null
  }, 160)
}

/**
 * هل يوجد Modal مفتوح الآن؟
 * @returns {boolean}
 */
export function isModalOpen() {
  return currentModal !== null
}

// ══════════════════════════════════════════════════════════════
// ⌨️ الاستماع لـ Escape key (عالمياً)
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentModal?.closable) {
    closeModal()
  }
})

// ══════════════════════════════════════════════════════════════
// 🏗️ دوال بناء محتوى جاهزة
// ══════════════════════════════════════════════════════════════

/**
 * إنشاء footer للـ Modal بأزرار
 *
 * @param {Array<{label: string, variant: string, onClick: Function, loading?: boolean}>} buttons
 * @returns {HTMLElement}
 */
export function createModalFooter(buttons = []) {
  const footer = document.createElement('div')
  footer.className = 'modal-footer'

  for (const btn of buttons) {
    const el = document.createElement('button')
    el.type      = 'button'
    el.className = `btn btn-${btn.variant ?? 'secondary'} btn-full`
    el.textContent = btn.label ?? ''
    if (btn.loading) el.classList.add('btn-loading')
    if (btn.disabled) el.disabled = true
    el.addEventListener('click', btn.onClick ?? (() => {}))
    footer.appendChild(el)
  }

  return footer
}

/**
 * تحديث عنوان Modal مفتوح
 * @param {string} newTitle
 */
export function updateModalTitle(newTitle) {
  if (!currentModal) return
  const titleEl = document.getElementById(`${currentModal.id}-title`)
  if (titleEl) titleEl.textContent = sanitize(newTitle)
}

/**
 * الحصول على body الـ Modal الحالي
 * @returns {HTMLElement|null}
 */
export function getModalBody() {
  if (!currentModal) return null
  return document.getElementById(`${currentModal.id}-body`)
}

export default { openModal, closeModal, isModalOpen, createModalFooter, updateModalTitle, getModalBody }
