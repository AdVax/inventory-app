/**
 * src/components/confirmDialog.js
 * ──────────────────────────────────────────────────────────────
 * ⚠️ نافذة التأكيد
 *
 * تُستخدم لتأكيد العمليات الحساسة:
 * - أرشفة المواد
 * - تفعيل/تعطيل الوحدات
 * - أي عملية لا يمكن التراجع عنها
 *
 * توفر:
 * 1. confirm()          - نافذة تأكيد عامة
 * 2. confirmArchive()   - متخصصة للأرشفة مع حقل السبب
 * 3. confirmDelete()    - متخصصة للحذف
 * ──────────────────────────────────────────────────────────────
 */

import { openModal, closeModal } from './modal.js'
import { sanitize } from '../utils/security.js'

// ══════════════════════════════════════════════════════════════
// ⚠️ 1. نافذة تأكيد عامة
// ══════════════════════════════════════════════════════════════

/**
 * عرض نافذة تأكيد
 *
 * @param {object} options
 * @param {string}   options.title
 * @param {string}   options.message
 * @param {string}   [options.confirmLabel='تأكيد']
 * @param {string}   [options.cancelLabel='إلغاء']
 * @param {'danger'|'warning'|'primary'} [options.variant='danger']
 * @param {Function} options.onConfirm  - عند التأكيد
 * @param {Function} [options.onCancel] - عند الإلغاء
 * @returns {void}
 */
export function confirm({
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel  = 'إلغاء',
  variant      = 'danger',
  onConfirm,
  onCancel,
} = {}) {

  // ── أيقونة التحذير ─────────────────────────────────────────
  const iconColors = {
    danger:  { bg: 'rgba(239,68,68,0.12)',  color: '#f87171'  },
    warning: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24'  },
    primary: { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa'  },
  }
  const { bg, color } = iconColors[variant] ?? iconColors.danger

  const alertIcon = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `

  // ── بناء المحتوى ───────────────────────────────────────────
  const content = document.createElement('div')
  content.style.cssText = 'display:flex; flex-direction:column; gap:1rem;'

  content.innerHTML = `
    <div style="
      width:3rem; height:3rem; border-radius:12px;
      background:${bg}; display:flex; align-items:center;
      justify-content:center; margin:0 auto;
    ">${alertIcon}</div>

    <p style="
      color:#cbd5e1; font-size:0.875rem;
      text-align:center; line-height:1.6;
    ">${sanitize(message ?? '')}</p>

    <div style="display:flex; gap:0.75rem; padding-top:0.25rem;">
      <button
        id="confirm-cancel-btn"
        class="btn btn-ghost btn-full"
        type="button"
      >${sanitize(cancelLabel)}</button>
      <button
        id="confirm-ok-btn"
        class="btn btn-${variant} btn-full"
        type="button"
      >${sanitize(confirmLabel)}</button>
    </div>
  `

  const { close } = openModal({
    title,
    content,
    size:     'sm',
    closable: true,
    onClose:  () => onCancel?.(),
  })

  // ── ربط الأزرار ────────────────────────────────────────────
  content.querySelector('#confirm-cancel-btn')?.addEventListener('click', () => {
    close()
    onCancel?.()
  })

  content.querySelector('#confirm-ok-btn')?.addEventListener('click', async () => {
    const btn = content.querySelector('#confirm-ok-btn')
    if (btn) {
      btn.classList.add('btn-loading')
      btn.disabled = true
    }
    // إغلاق الـ Cancel أيضاً
    const cancelBtn = content.querySelector('#confirm-cancel-btn')
    if (cancelBtn) cancelBtn.disabled = true

    try {
      await onConfirm?.()
      close()
    } catch (e) {
      // الـ error يُعرض من الـ caller
      if (btn) {
        btn.classList.remove('btn-loading')
        btn.disabled = false
      }
      if (cancelBtn) cancelBtn.disabled = false
    }
  })
}

// ══════════════════════════════════════════════════════════════
// 🗃️ 2. نافذة تأكيد الأرشفة (مع حقل السبب الإلزامي)
// ══════════════════════════════════════════════════════════════

/**
 * نافذة أرشفة مادة مع حقل سبب إلزامي
 *
 * @param {object} options
 * @param {string}   options.itemName   - اسم العنصر المراد أرشفته
 * @param {number}   [options.stockQty] - الكمية المتبقية (للتحذير)
 * @param {string}   [options.unitSymbol]
 * @param {Function} options.onConfirm  - يُستدعى مع (reason: string)
 * @param {Function} [options.onCancel]
 */
export function confirmArchive({
  itemName,
  stockQty    = 0,
  unitSymbol  = '',
  onConfirm,
  onCancel,
} = {}) {

  // ── بناء المحتوى ───────────────────────────────────────────
  const content = document.createElement('div')
  content.style.cssText = 'display:flex; flex-direction:column; gap:1rem;'

  const hasStock = Number(stockQty) > 0

  content.innerHTML = `
    <!-- تحذير -->
    <div style="
      display:flex; gap:0.75rem; align-items:flex-start;
      background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25);
      border-radius:12px; padding:0.875rem;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" style="flex-shrink:0; margin-top:1px;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div>
        <p style="font-weight:700; color:#fbbf24; font-size:0.8125rem; margin-bottom:4px;">
          تنبيه: الأرشفة ليست حذفاً نهائياً
        </p>
        <p style="color:rgba(251,191,36,0.75); font-size:0.75rem; line-height:1.5;">
          ستُخفى المادة <strong style="color:#fbbf24;">"${sanitize(itemName)}"</strong>
          من القوائم مع الاحتفاظ بكل حركاتها وتاريخها.
        </p>
      </div>
    </div>

    <!-- معلومات المادة -->
    <div style="
      background:rgba(30,41,59,0.6); border-radius:10px; padding:0.75rem;
      display:flex; flex-direction:column; gap:0.375rem; font-size:0.8125rem;
    ">
      <div style="display:flex; justify-content:space-between; color:#cbd5e1;">
        <span style="color:#94a3b8;">المادة:</span>
        <strong>${sanitize(itemName)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; color:#cbd5e1;">
        <span style="color:#94a3b8;">المخزون الحالي:</span>
        <span style="font-family:monospace; color:${hasStock ? '#fbbf24' : '#4ade80'};">
          ${Number(stockQty).toLocaleString('ar')} ${sanitize(unitSymbol)}
        </span>
      </div>
      ${hasStock ? `
        <p style="color:#f87171; font-size:0.75rem; margin-top:4px; display:flex; align-items:center; gap:4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          يوجد مخزون متبقٍ — يُنصح بتسويته قبل الأرشفة
        </p>
      ` : ''}
    </div>

    <!-- سبب الأرشفة (إلزامي) -->
    <div class="form-group">
      <label class="form-label" for="archive-reason-input">
        سبب الأرشفة
        <span class="required">*</span>
        <span style="font-weight:400; color:#64748b; font-size:0.75rem;">(للتوثيق المحاسبي)</span>
      </label>
      <textarea
        id="archive-reason-input"
        class="form-textarea"
        rows="3"
        placeholder="مثال: تم إيقاف التعامل بهذه المادة / انتهت صلاحيتها..."
        maxlength="500"
      ></textarea>
      <p id="archive-reason-error" class="form-error" style="display:none;"></p>
      <p class="form-hint" id="archive-reason-counter">0 / 500</p>
    </div>

    <!-- الأزرار -->
    <div style="display:flex; gap:0.75rem;">
      <button id="archive-cancel-btn" class="btn btn-ghost btn-full" type="button">إلغاء</button>
      <button id="archive-confirm-btn" class="btn btn-danger btn-full" type="button" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-8 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
        </svg>
        تأكيد الأرشفة
      </button>
    </div>
  `

  const { close } = openModal({
    title:    'أرشفة المادة',
    content,
    size:     'sm',
    closable: true,
    onClose:  () => onCancel?.(),
  })

  // ── منطق الـ Textarea ──────────────────────────────────────
  const textarea    = content.querySelector('#archive-reason-input')
  const confirmBtn  = content.querySelector('#archive-confirm-btn')
  const errorEl     = content.querySelector('#archive-reason-error')
  const counterEl   = content.querySelector('#archive-reason-counter')

  textarea?.addEventListener('input', () => {
    const val     = textarea.value.trim()
    const len     = textarea.value.length
    const isValid = val.length >= 5

    if (counterEl) counterEl.textContent = `${len} / 500`
    confirmBtn.disabled = !isValid

    if (errorEl) {
      if (val.length > 0 && !isValid) {
        errorEl.textContent = '⚠ السبب يجب أن يكون 5 أحرف على الأقل'
        errorEl.style.display = 'flex'
        textarea.classList.add('has-error')
      } else {
        errorEl.style.display = 'none'
        textarea.classList.remove('has-error')
      }
    }
  })

  // ── ربط الأزرار ────────────────────────────────────────────
  content.querySelector('#archive-cancel-btn')?.addEventListener('click', () => {
    close()
    onCancel?.()
  })

  confirmBtn?.addEventListener('click', async () => {
    const reason = textarea?.value.trim()
    if (!reason || reason.length < 5) {
      if (errorEl) {
        errorEl.textContent = '⚠ سبب الأرشفة مطلوب (5 أحرف على الأقل)'
        errorEl.style.display = 'flex'
      }
      textarea?.focus()
      return
    }

    confirmBtn.classList.add('btn-loading')
    confirmBtn.disabled = true
    content.querySelector('#archive-cancel-btn').disabled = true

    try {
      await onConfirm?.(reason)
      close()
    } catch {
      confirmBtn.classList.remove('btn-loading')
      confirmBtn.disabled = false
      content.querySelector('#archive-cancel-btn').disabled = false
    }
  })

  // التركيز على الـ textarea
  requestAnimationFrame(() => textarea?.focus())
}

// ══════════════════════════════════════════════════════════════
// 🗑️ 3. نافذة تأكيد بسيطة للحذف/التعطيل
// ══════════════════════════════════════════════════════════════

/**
 * نافذة تأكيد تعطيل/تفعيل عنصر
 *
 * @param {object} options
 * @param {string}   options.itemName
 * @param {boolean}  options.isActive   - الحالة الحالية
 * @param {Function} options.onConfirm
 * @param {Function} [options.onCancel]
 */
export function confirmToggleActive({ itemName, isActive, onConfirm, onCancel } = {}) {
  confirm({
    title:        isActive ? 'تعطيل العنصر' : 'تفعيل العنصر',
    message:      isActive
      ? `هل تريد تعطيل "${itemName}"؟ لن يظهر في قوائم الإضافة لكن بياناته محفوظة.`
      : `هل تريد إعادة تفعيل "${itemName}"؟`,
    confirmLabel: isActive ? 'تعطيل' : 'تفعيل',
    variant:      isActive ? 'danger' : 'warning',
    onConfirm,
    onCancel,
  })
}

export default { confirm, confirmArchive, confirmToggleActive }
