/**
 * src/pages/transactions/transactions.page.js
 * ──────────────────────────────────────────────────────────────
 * 📋 صفحة سجل الحركات المحاسبية
 * ──────────────────────────────────────────────────────────────
 */

import { getTransactions, TRANSACTION_TYPES } from '../../services/transactions.service.js'
import { selectIsAdmin }   from '../../store/store.js'
import { sanitize }        from '../../utils/security.js'
import { formatDate, formatQuantity, txSign, txTypeColor, daysAgoISO, todayISO } from '../../utils/formatters.js'
import { showTableSkeleton, showEmptyState } from '../../components/spinner.js'
import { toast }           from '../../components/toast.js'
import { renderNewTransaction } from './newTransaction.js'

// ══════════════════════════════════════════════════════════════
export async function render(container) {
  const isAdmin = selectIsAdmin()

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">

      <!-- الهيدر -->
      <div class="page-header">
        <div>
          <h1 class="page-title">سجل الحركات</h1>
          <p class="page-subtitle" id="tx-subtitle">جاري التحميل...</p>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button id="refresh-btn" class="btn btn-ghost btn-sm">${refreshIcon()}</button>
          ${isAdmin ? `<button id="new-tx-btn" class="btn btn-primary btn-sm">${plusIcon()} حركة جديدة</button>` : ''}
        </div>
      </div>

      <!-- الفلاتر -->
      <div class="card" style="padding:0.875rem;">
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:flex-end;">
          <!-- بحث -->
          <div class="search-wrapper" style="flex:1; min-width:160px;">
            <span class="search-icon">${searchIcon()}</span>
            <input id="search-input" class="search-input" type="text" placeholder="بحث في المادة أو المرجع..." />
          </div>
          <!-- نوع الحركة -->
          <div class="form-group" style="min-width:140px; margin:0;">
            <select id="type-filter" class="form-select" style="font-size:0.8125rem; padding:0.4rem 0.625rem; padding-left:2rem;">
              <option value="">كل الأنواع</option>
              ${Object.entries(TRANSACTION_TYPES).map(([k, v]) =>
                `<option value="${k}">${v.icon} ${v.label}</option>`
              ).join('')}
            </select>
          </div>
          <!-- من تاريخ -->
          <div class="form-group" style="margin:0;">
            <input id="date-from" class="form-input ltr" type="date" style="font-size:0.8125rem; padding:0.4rem 0.625rem; width:140px;" dir="ltr" value="${daysAgoISO(30)}" />
          </div>
          <!-- إلى تاريخ -->
          <div class="form-group" style="margin:0;">
            <input id="date-to" class="form-input ltr" type="date" style="font-size:0.8125rem; padding:0.4rem 0.625rem; width:140px;" dir="ltr" value="${todayISO()}" />
          </div>
          <button id="reset-filters-btn" class="btn btn-ghost btn-sm" style="font-size:0.75rem;">مسح</button>
        </div>
      </div>

      <!-- الجدول -->
      <div id="tx-container"></div>
    </div>
  `

  let allTx      = []
  let searchQ    = ''

  // ── جلب البيانات ───────────────────────────────────────────
  async function loadTransactions() {
    const txContainer = container.querySelector('#tx-container')
    showTableSkeleton(txContainer, 8, 7)

    const dateFrom = container.querySelector('#date-from')?.value || undefined
    const dateTo   = container.querySelector('#date-to')?.value   || undefined
    const txType   = container.querySelector('#type-filter')?.value || undefined

    const { data, count, error } = await getTransactions({
      dateFrom, dateTo, type: txType, limit: 200,
    })

    if (error) {
      showEmptyState(txContainer, { title: 'تعذّر تحميل الحركات', text: error })
      return
    }

    allTx = data ?? []

    const subtitle = container.querySelector('#tx-subtitle')
    if (subtitle) subtitle.textContent = `${allTx.length} حركة`

    renderTable()
  }

  // ── رسم الجدول ────────────────────────────────────────────
  function renderTable() {
    const txContainer = container.querySelector('#tx-container')
    if (!txContainer) return

    let filtered = allTx
    if (searchQ) {
      const q = searchQ.toLowerCase()
      filtered = allTx.filter(tx =>
        tx.material_name?.toLowerCase().includes(q) ||
        tx.reference_number?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        tx.creator_name?.toLowerCase().includes(q)
      )
    }

    if (filtered.length === 0) {
      showEmptyState(txContainer, {
        title: searchQ ? 'لا نتائج للبحث' : 'لا توجد حركات في هذه الفترة',
        text: 'جرّب تغيير الفلاتر أو نطاق التاريخ',
      })
      return
    }

    // ── Desktop ────────────────────────────────────────────
    const desktopHtml = `
      <div class="hide-mobile card" style="padding:0; overflow:hidden;">
        <div class="overflow-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>التاريخ</th><th>المادة</th><th>نوع الحركة</th>
                <th>الكمية</th><th>قبل</th><th>بعد</th><th>مرجع</th><th>بواسطة</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(tx => `
                <tr>
                  <td style="font-size:0.75rem; color:#64748b; white-space:nowrap;">${formatDate(tx.created_at, {withTime:true})}</td>
                  <td style="font-weight:600; color:#e2e8f0;">${sanitize(tx.material_name)}</td>
                  <td><span style="font-size:0.75rem;">${sanitize(tx.type_icon)} ${sanitize(tx.type_label)}</span></td>
                  <td>
                    <span style="font-family:monospace; font-weight:700; direction:ltr; display:inline-block; color:${tx.type_direction === 1 ? '#4ade80' : '#f87171'};">
                      ${tx.type_direction === 1 ? '+' : '-'}${formatQuantity(tx.quantity)} ${sanitize(tx.unit_symbol ?? '')}
                    </span>
                  </td>
                  <td style="font-family:monospace; font-size:0.75rem; color:#64748b; direction:ltr;">${Number(tx.stock_before).toLocaleString('ar')}</td>
                  <td style="font-family:monospace; font-size:0.75rem; color:#cbd5e1; font-weight:600; direction:ltr;">${Number(tx.stock_after).toLocaleString('ar')}</td>
                  <td style="font-family:monospace; font-size:0.75rem; color:#475569;">${tx.reference_number ? `#${sanitize(tx.reference_number)}` : '—'}</td>
                  <td style="font-size:0.75rem; color:#64748b;">${sanitize(tx.creator_name)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    // ── Mobile ─────────────────────────────────────────────
    const mobileHtml = `
      <div class="hide-desktop" style="display:flex; flex-direction:column; gap:0.625rem;">
        ${filtered.map(tx => {
          const isIn = tx.type_direction === 1
          const color = isIn ? '#4ade80' : '#f87171'
          return `
            <div class="mobile-card">
              <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.5rem;">
                <div style="flex:1; min-width:0;">
                  <p style="font-weight:700; color:#e2e8f0; font-size:0.875rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sanitize(tx.material_name)}</p>
                  <p style="font-size:0.7rem; color:#64748b; margin-top:1px;">${sanitize(tx.type_icon)} ${sanitize(tx.type_label)}</p>
                </div>
                <span style="font-family:monospace; font-weight:800; font-size:1rem; color:${color}; direction:ltr; flex-shrink:0;">
                  ${isIn ? '+' : '-'}${formatQuantity(tx.quantity)}
                </span>
              </div>
              <div style="display:flex; gap:1rem; margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid rgba(51,65,85,0.4); font-size:0.7rem; color:#475569;">
                <span>${formatDate(tx.created_at)}</span>
                <span style="font-family:monospace; direction:ltr;">${Number(tx.stock_before).toLocaleString('ar')} → ${Number(tx.stock_after).toLocaleString('ar')}</span>
                ${tx.reference_number ? `<span style="font-family:monospace;">#${sanitize(tx.reference_number)}</span>` : ''}
              </div>
              ${tx.notes ? `<p style="font-size:0.7rem; color:#475569; margin-top:4px; font-style:italic; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sanitize(tx.notes)}</p>` : ''}
            </div>
          `
        }).join('')}
      </div>
    `

    txContainer.innerHTML = desktopHtml + mobileHtml
  }

  // ── ربط الأحداث ───────────────────────────────────────────
  container.querySelector('#new-tx-btn')?.addEventListener('click', () => {
    renderNewTransaction({ onSuccess: () => { toast.success('تم تسجيل الحركة بنجاح'); loadTransactions() } })
  })

  container.querySelector('#refresh-btn')?.addEventListener('click', loadTransactions)

  container.querySelector('#search-input')?.addEventListener('input', (e) => {
    searchQ = e.target.value.trim()
    renderTable()
  })

  // إعادة الجلب عند تغيير الفلاتر
  ;['type-filter', 'date-from', 'date-to'].forEach(id => {
    container.querySelector(`#${id}`)?.addEventListener('change', loadTransactions)
  })

  container.querySelector('#reset-filters-btn')?.addEventListener('click', () => {
    container.querySelector('#type-filter').value = ''
    container.querySelector('#date-from').value   = daysAgoISO(30)
    container.querySelector('#date-to').value     = todayISO()
    searchQ = ''
    container.querySelector('#search-input').value = ''
    loadTransactions()
  })

  await loadTransactions()
}

const svg = (p) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`
const plusIcon    = () => svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')
const refreshIcon = () => svg('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>')
const searchIcon  = () => svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>')
