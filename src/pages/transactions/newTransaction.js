/**
 * src/pages/transactions/newTransaction.js
 * ──────────────────────────────────────────────────────────────
 * ➕ نموذج تسجيل حركة محاسبية جديدة
 * ──────────────────────────────────────────────────────────────
 */

import { createTransaction, TRANSACTION_TYPES } from '../../services/transactions.service.js'
import { getMaterials }          from '../../services/materials.service.js'
import { store }                 from '../../store/store.js'
import { openModal, closeModal } from '../../components/modal.js'
import { toast }                 from '../../components/toast.js'
import { transactionSchema, showFormErrors, clearFormErrors } from '../../utils/validators.js'
import { sanitize }              from '../../utils/security.js'
import { formatQuantity }        from '../../utils/formatters.js'

// ══════════════════════════════════════════════════════════════
export async function renderNewTransaction({ onSuccess, defaultMaterialId = null, defaultType = 'stock_in' } = {}) {

  const user               = store.getState('user')
  const exchangeRate        = store.getState('latestExchangeRate')
  const { data: materials  = [] } = await getMaterials({ includeArchived: false })

  let selectedType     = defaultType
  let selectedMaterial = materials.find(m => m.id === defaultMaterialId) ?? null

  // ── بناء المحتوى ───────────────────────────────────────────
  const content = document.createElement('div')
  content.style.cssText = 'display:flex; flex-direction:column; gap:1rem;'

  function buildContent() {
    const typeInfo = TRANSACTION_TYPES[selectedType]
    const isNeg    = typeInfo?.direction === -1

    content.innerHTML = `
      <!-- نوع الحركة -->
      <div>
        <p style="font-size:0.75rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">نوع الحركة</p>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.375rem;">
          ${Object.entries(TRANSACTION_TYPES).map(([key, val]) => `
            <button type="button" data-tx-type="${key}" class="btn btn-sm ${selectedType === key ? (val.direction === 1 ? 'btn-success' : 'btn-danger') : 'btn-ghost'}"
              style="font-size:0.75rem; justify-content:flex-start; gap:0.375rem; ${selectedType === key ? '' : 'opacity:0.7'}">
              <span>${val.icon}</span> ${val.label}
            </button>
          `).join('')}
        </div>
        <div style="
          display:flex; align-items:center; gap:0.5rem; margin-top:0.5rem;
          background:rgba(51,65,85,0.3); border-radius:8px; padding:0.5rem 0.75rem;
          font-size:0.75rem; color:#94a3b8;
        ">
          ${infoIcon()} ${typeInfo?.direction === 1 ? 'هذه الحركة ستزيد المخزون' : 'هذه الحركة ستنقص المخزون'}
        </div>
      </div>

      <hr class="divider" />

      <!-- النموذج -->
      <form id="tx-form" novalidate style="display:flex; flex-direction:column; gap:0.875rem;">
        <input type="hidden" name="transaction_type" value="${selectedType}" />

        <!-- المادة -->
        <div class="form-group">
          <label class="form-label" for="tx-material">المادة <span class="required">*</span></label>
          <select id="tx-material" name="material_id" class="form-select" required>
            <option value="">اختر المادة...</option>
            ${materials.map(m => `
              <option value="${sanitize(m.id)}" ${selectedMaterial?.id === m.id ? 'selected' : ''}>
                ${sanitize(m.name)}${m.code ? ` (${sanitize(m.code)})` : ''} — ${formatQuantity(m.current_stock)} ${sanitize(m.unit_symbol ?? '')}
              </option>
            `).join('')}
          </select>
          <p class="form-error" style="display:none;"></p>
        </div>

        <!-- معلومات المادة المختارة -->
        <div id="material-info" style="${selectedMaterial ? '' : 'display:none;'}">
          ${selectedMaterial ? renderMaterialInfo(selectedMaterial, selectedType, '') : ''}
        </div>

        <!-- الكمية -->
        <div class="form-group">
          <label class="form-label" for="tx-qty">
            الكمية ${selectedMaterial ? `(${sanitize(selectedMaterial.unit_symbol ?? '')})` : ''} <span class="required">*</span>
          </label>
          <input id="tx-qty" name="quantity" class="form-input ltr" type="number"
            min="0.001" step="any" placeholder="0" dir="ltr" required />
          <p class="form-error" style="display:none;"></p>
        </div>

        <!-- الرصيد المتوقع -->
        <div id="expected-stock-info" style="display:none;"></div>

        <!-- الأسعار (قابل للطي) -->
        <details style="border:1px solid rgba(51,65,85,0.5); border-radius:10px; overflow:hidden;">
          <summary style="padding:0.625rem 0.875rem; cursor:pointer; font-size:0.8125rem; color:#94a3b8; list-style:none; display:flex; align-items:center; gap:0.5rem;">
            ${settingsIcon()} معلومات التسعير (اختياري)
          </summary>
          <div style="padding:0.75rem 0.875rem; display:grid; grid-template-columns:1fr 1fr; gap:0.625rem; border-top:1px solid rgba(51,65,85,0.4);">
            <div class="form-group" style="margin:0;">
              <label class="form-label" for="tx-cost-syp">سعر الوحدة (ل.س)</label>
              <input id="tx-cost-syp" name="unit_cost_syp" class="form-input ltr" type="number" min="0" step="any" placeholder="0" dir="ltr"
                value="${selectedMaterial?.unit_cost_syp > 0 ? selectedMaterial.unit_cost_syp : ''}" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label" for="tx-cost-usd">سعر الوحدة ($)</label>
              <input id="tx-cost-usd" name="unit_cost_usd" class="form-input ltr" type="number" min="0" step="0.01" placeholder="0.00" dir="ltr"
                value="${selectedMaterial?.unit_cost_usd > 0 ? selectedMaterial.unit_cost_usd : ''}" />
            </div>
          </div>
          ${exchangeRate ? `
            <p style="padding:0 0.875rem 0.625rem; font-size:0.7rem; color:#475569; display:flex; align-items:center; gap:0.375rem;">
              ${infoIcon()} سعر الصرف المستخدم:
              <span style="font-family:monospace; color:#94a3b8;">${Number(exchangeRate.usd_to_syp).toLocaleString('ar')} ل.س / $</span>
            </p>
          ` : ''}
        </details>

        <!-- الرقم المرجعي + الملاحظات -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.625rem;">
          <div class="form-group" style="margin:0;">
            <label class="form-label" for="tx-ref">الرقم المرجعي</label>
            <input id="tx-ref" name="reference_number" class="form-input ltr" type="text"
              placeholder="INV-001" maxlength="50" dir="ltr" />
            <p class="form-hint">رقم الفاتورة أو أمر الشراء</p>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label" for="tx-notes">ملاحظات</label>
            <input id="tx-notes" name="notes" class="form-input" type="text"
              placeholder="${selectedType === 'disposal' ? 'سبب الإتلاف...' : 'تفاصيل إضافية...'}"
              maxlength="200" />
          </div>
        </div>

        <!-- رسالة خطأ -->
        <div id="tx-general-error" class="alert alert-danger" style="display:none;"></div>

        <!-- ملخص الحركة -->
        <div id="tx-summary" style="display:none;"></div>

        <!-- الأزرار -->
        <div style="display:flex; gap:0.75rem;">
          <button type="button" id="tx-cancel-btn" class="btn btn-ghost btn-full">إلغاء</button>
          <button type="submit" id="tx-submit-btn" class="btn ${isNeg ? 'btn-danger' : 'btn-primary'} btn-full">
            تسجيل الحركة
          </button>
        </div>
      </form>
    `

    bindEvents()
  }

  function renderMaterialInfo(material, txType, qtyStr) {
    const qty      = parseFloat(qtyStr) || 0
    const typeInfo = TRANSACTION_TYPES[txType]
    const expected = qty > 0
      ? (typeInfo?.direction === 1
          ? material.current_stock + qty
          : material.current_stock - qty)
      : null

    const isNegBalance = expected !== null && expected < 0

    return `
      <div style="background:rgba(30,41,59,0.6); border-radius:10px; padding:0.75rem; font-size:0.8125rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.375rem;">
          <span style="color:#64748b;">المخزون الحالي</span>
          <span style="font-family:monospace; font-weight:700; color:#e2e8f0;">
            ${formatQuantity(material.current_stock)} ${sanitize(material.unit_symbol ?? '')}
          </span>
        </div>
        ${expected !== null ? `
          <div style="display:flex; justify-content:space-between; padding-top:0.375rem; border-top:1px solid rgba(51,65,85,0.4);">
            <span style="color:#64748b;">الرصيد بعد الحركة</span>
            <span style="font-family:monospace; font-weight:800; color:${isNegBalance ? '#f87171' : expected === 0 ? '#fbbf24' : '#4ade80'};">
              ${formatQuantity(expected)} ${sanitize(material.unit_symbol ?? '')}
            </span>
          </div>
          ${isNegBalance ? `
            <div class="alert alert-danger" style="margin-top:0.5rem; padding:0.5rem 0.75rem; font-size:0.75rem;">
              ${warnIcon()} الكمية تتجاوز المخزون — سيُرفض هذا الطلب من السيرفر
            </div>
          ` : ''}
        ` : ''}
      </div>
    `
  }

  function bindEvents() {
    const form     = content.querySelector('#tx-form')
    const matSel   = content.querySelector('#tx-material')
    const qtyInput = content.querySelector('#tx-qty')
    const submitBtn = content.querySelector('#tx-submit-btn')
    const errorBox  = content.querySelector('#tx-general-error')

    // تغيير نوع الحركة
    content.querySelectorAll('[data-tx-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedType = btn.dataset.txType
        selectedMaterial = materials.find(m => m.id === matSel?.value) ?? null
        buildContent()
      })
    })

    // تغيير المادة
    matSel?.addEventListener('change', () => {
      selectedMaterial = materials.find(m => m.id === matSel.value) ?? null
      const infoEl = content.querySelector('#material-info')
      if (infoEl) {
        infoEl.style.display = selectedMaterial ? '' : 'none'
        infoEl.innerHTML = selectedMaterial
          ? renderMaterialInfo(selectedMaterial, selectedType, qtyInput?.value ?? '')
          : ''
      }
    })

    // تغيير الكمية
    qtyInput?.addEventListener('input', () => {
      const infoEl = content.querySelector('#material-info')
      if (infoEl && selectedMaterial) {
        infoEl.innerHTML = renderMaterialInfo(selectedMaterial, selectedType, qtyInput.value)
      }
    })

    content.querySelector('#tx-cancel-btn')?.addEventListener('click', () => closeModal())

    // إرسال النموذج
    form?.addEventListener('submit', async (e) => {
      e.preventDefault()
      clearFormErrors(form)

      const data = {
        transaction_type: selectedType,
        material_id:      form.querySelector('[name=material_id]')?.value  ?? '',
        quantity:         form.querySelector('[name=quantity]')?.value      ?? '',
        unit_cost_syp:    form.querySelector('[name=unit_cost_syp]')?.value ?? '',
        unit_cost_usd:    form.querySelector('[name=unit_cost_usd]')?.value ?? '',
        reference_number: form.querySelector('[name=reference_number]')?.value ?? '',
        notes:            form.querySelector('[name=notes]')?.value ?? '',
      }

      const errors = transactionSchema.validate(data)
      if (Object.keys(errors).length > 0) { showFormErrors(errors, form); return }

      submitBtn.classList.add('btn-loading')
      submitBtn.disabled = true
      if (errorBox) errorBox.style.display = 'none'

      const { data: result, error } = await createTransaction({
        ...data,
        quantity:      parseFloat(data.quantity),
        unit_cost_syp: parseFloat(data.unit_cost_syp) || 0,
        unit_cost_usd: parseFloat(data.unit_cost_usd) || 0,
        exchange_rate: exchangeRate?.usd_to_syp ?? null,
      }, user.id)

      submitBtn.classList.remove('btn-loading')
      submitBtn.disabled = false

      if (error) {
        if (errorBox) { errorBox.textContent = error; errorBox.style.display = 'flex' }
        return
      }

      closeModal()
      onSuccess?.()
    })
  }

  buildContent()

  openModal({
    title:    'تسجيل حركة جديدة',
    content,
    size:     'lg',
    closable: true,
  })
}

// Icons
const svg = (p) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`
const infoIcon     = () => svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>')
const warnIcon     = () => svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>')
const settingsIcon = () => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>')
