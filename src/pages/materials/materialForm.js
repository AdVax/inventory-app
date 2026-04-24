/**
 * src/pages/materials/materialForm.js
 * ──────────────────────────────────────────────────────────────
 * 📝 نموذج إضافة وتعديل المادة
 * ──────────────────────────────────────────────────────────────
 */

import { createMaterial, updateMaterial } from '../../services/materials.service.js'
import { getUnits }                        from '../../services/units.service.js'
import { store }                           from '../../store/store.js'
import { openModal, closeModal }           from '../../components/modal.js'
import { toast }                           from '../../components/toast.js'
import { materialSchema, showFormErrors, clearFormErrors } from '../../utils/validators.js'
import { sanitize, cleanString }           from '../../utils/security.js'

// ══════════════════════════════════════════════════════════════
/**
 * @param {object} options
 * @param {object|null} options.material  - null للإضافة، object للتعديل
 * @param {Function} options.onSuccess
 */
export async function renderMaterialForm({ material = null, onSuccess }) {
  const isEdit  = !!material
  const user    = store.getState('user')

  // جلب الوحدات
  const { data: units = [] } = await getUnits(true)

  if (units.length === 0) {
    toast.warning('يجب إضافة وحدة قياس أولاً من صفحة الإعدادات')
    return
  }

  // ── بناء المحتوى ───────────────────────────────────────────
  const content = document.createElement('div')
  content.innerHTML = `
    <form id="material-form" novalidate style="display:flex; flex-direction:column; gap:1rem;">

      <!-- الاسم + الرمز -->
      <div style="display:grid; grid-template-columns:1fr auto; gap:0.75rem; align-items:start;">
        <div class="form-group">
          <label class="form-label" for="mat-name">اسم المادة <span class="required">*</span></label>
          <input id="mat-name" name="name" class="form-input" type="text"
            placeholder="مثال: زيت زيتون" maxlength="150"
            value="${sanitize(material?.name ?? '')}" required />
          <p class="form-error" style="display:none;"></p>
        </div>
        <div class="form-group" style="width:110px;">
          <label class="form-label" for="mat-code">الرمز</label>
          <input id="mat-code" name="code" class="form-input ltr" type="text"
            placeholder="OIL-01" maxlength="50" dir="ltr"
            value="${sanitize(material?.code ?? '')}" />
        </div>
      </div>

      <!-- وحدة القياس -->
      <div class="form-group">
        <label class="form-label" for="mat-unit">وحدة القياس <span class="required">*</span></label>
        <select id="mat-unit" name="unit_id" class="form-select" required>
          <option value="">اختر وحدة القياس...</option>
          ${units.map(u => `
            <option value="${sanitize(u.id)}" ${material?.unit_id === u.id ? 'selected' : ''}>
              ${sanitize(u.name)} (${sanitize(u.symbol)})
            </option>
          `).join('')}
        </select>
        <p class="form-error" style="display:none;"></p>
      </div>

      <!-- الوصف -->
      <div class="form-group">
        <label class="form-label" for="mat-desc">الوصف <span style="font-weight:400; color:#64748b; font-size:0.75rem;">(اختياري)</span></label>
        <textarea id="mat-desc" name="description" class="form-textarea" rows="2"
          placeholder="وصف مختصر للمادة..." maxlength="500"
        >${sanitize(material?.description ?? '')}</textarea>
      </div>

      <!-- فاصل -->
      <hr class="divider" />
      <p style="font-size:0.75rem; color:#64748b; display:flex; align-items:center; gap:0.375rem; margin-bottom:-0.25rem;">
        ${settingsIcon()} إعدادات اختيارية
      </p>

      <!-- حد التنبيه + الأسعار -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem;">
        <div class="form-group">
          <label class="form-label" for="mat-alert">حد التنبيه</label>
          <input id="mat-alert" name="min_stock_alert" class="form-input ltr" type="number"
            min="0" step="any" placeholder="0" dir="ltr"
            value="${material?.min_stock_alert ?? ''}" />
          <p class="form-hint">تنبيه عند الوصول لهذا الحد</p>
          <p class="form-error" style="display:none;"></p>
        </div>
        <div class="form-group">
          <label class="form-label" for="mat-cost-syp">سعر الوحدة (ل.س)</label>
          <input id="mat-cost-syp" name="unit_cost_syp" class="form-input ltr" type="number"
            min="0" step="any" placeholder="0" dir="ltr"
            value="${material?.unit_cost_syp ?? ''}" />
          <p class="form-error" style="display:none;"></p>
        </div>
        <div class="form-group">
          <label class="form-label" for="mat-cost-usd">سعر الوحدة ($)</label>
          <input id="mat-cost-usd" name="unit_cost_usd" class="form-input ltr" type="number"
            min="0" step="0.01" placeholder="0.00" dir="ltr"
            value="${material?.unit_cost_usd ?? ''}" />
          <p class="form-error" style="display:none;"></p>
        </div>
      </div>

      <!-- رسالة خطأ عامة -->
      <div id="form-general-error" class="alert alert-danger" style="display:none;"></div>

      <!-- أزرار -->
      <div style="display:flex; gap:0.75rem; padding-top:0.25rem;">
        <button type="button" id="cancel-btn" class="btn btn-ghost btn-full">إلغاء</button>
        <button type="submit" id="submit-btn" class="btn btn-primary btn-full">
          ${isEdit ? 'حفظ التعديلات' : 'إضافة المادة'}
        </button>
      </div>
    </form>
  `

  const { close } = openModal({
    title:   isEdit ? 'تعديل المادة' : 'إضافة مادة جديدة',
    content,
    size:    'lg',
    closable: true,
  })

  const form      = content.querySelector('#material-form')
  const submitBtn = content.querySelector('#submit-btn')
  const errorBox  = content.querySelector('#form-general-error')

  content.querySelector('#cancel-btn')?.addEventListener('click', close)

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearFormErrors(form)

    const data = {
      name:            form.querySelector('[name=name]')?.value ?? '',
      code:            form.querySelector('[name=code]')?.value ?? '',
      description:     form.querySelector('[name=description]')?.value ?? '',
      unit_id:         form.querySelector('[name=unit_id]')?.value ?? '',
      min_stock_alert: form.querySelector('[name=min_stock_alert]')?.value ?? '',
      unit_cost_syp:   form.querySelector('[name=unit_cost_syp]')?.value ?? '',
      unit_cost_usd:   form.querySelector('[name=unit_cost_usd]')?.value ?? '',
    }

    const errors = materialSchema.validate(data)
    if (Object.keys(errors).length > 0) { showFormErrors(errors, form); return }

    submitBtn.classList.add('btn-loading')
    submitBtn.disabled = true
    if (errorBox) errorBox.style.display = 'none'

    let result
    if (isEdit) {
      result = await updateMaterial(material.id, data, user.id)
    } else {
      result = await createMaterial(data, user.id)
    }

    submitBtn.classList.remove('btn-loading')
    submitBtn.disabled = false

    if (result.error) {
      if (errorBox) { errorBox.textContent = result.error; errorBox.style.display = 'flex' }
      return
    }

    close()
    onSuccess?.()
  })
}

const settingsIcon = () => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
