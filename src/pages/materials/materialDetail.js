/**
 * src/pages/materials/materialDetail.js
 */
import { getTransactionsByMaterial } from '../../services/transactions.service.js'
import { openModal }                 from '../../components/modal.js'
import { sanitize }                  from '../../utils/security.js'
import { formatSYP, formatUSD, formatDate, formatQuantity, stockStatus, stockStatusClass } from '../../utils/formatters.js'
import { selectIsAdmin }             from '../../store/store.js'

export async function renderMaterialDetail({ material, onEdit }) {
  if (!material) return
  const isAdmin = selectIsAdmin()

  const { data: txList = [] } = await getTransactionsByMaterial(material.id, 8)
  const status = stockStatus(material.current_stock, material.min_stock_alert)

  const content = document.createElement('div')
  content.style.cssText = 'display:flex; flex-direction:column; gap:1rem;'

  content.innerHTML = `
    <!-- هيدر -->
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem;">
      <div>
        <h2 style="font-size:1.0625rem; font-weight:800; color:#f1f5f9;">${sanitize(material.name)}</h2>
        ${material.code ? `<p style="font-family:monospace; font-size:0.75rem; color:#475569;">${sanitize(material.code)}</p>` : ''}
        ${material.description ? `<p style="font-size:0.8125rem; color:#94a3b8; margin-top:4px;">${sanitize(material.description)}</p>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.375rem;">
        <span class="badge ${material.is_active ? 'badge-success' : 'badge-default'}">${material.is_active ? 'نشطة' : 'مؤرشفة'}</span>
        ${isAdmin && material.is_active ? `<button id="detail-edit-btn" class="btn btn-secondary btn-sm">${editIcon()} تعديل</button>` : ''}
      </div>
    </div>

    <!-- بطاقات المعلومات -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.625rem;">
      <div style="background:rgba(30,41,59,0.6); border-radius:10px; padding:0.75rem;">
        <p style="font-size:0.7rem; color:#64748b; margin-bottom:4px;">المخزون الحالي</p>
        <span class="stock-badge ${stockStatusClass(status)}">${formatQuantity(material.current_stock)} ${sanitize(material.unit_symbol ?? '')}</span>
      </div>
      <div style="background:rgba(30,41,59,0.6); border-radius:10px; padding:0.75rem;">
        <p style="font-size:0.7rem; color:#64748b; margin-bottom:4px;">وحدة القياس</p>
        <span class="badge badge-default">${sanitize(material.unit_name)} (${sanitize(material.unit_symbol ?? '')})</span>
      </div>
      ${material.min_stock_alert != null ? `
        <div style="background:rgba(30,41,59,0.6); border-radius:10px; padding:0.75rem;">
          <p style="font-size:0.7rem; color:#64748b; margin-bottom:4px;">حد التنبيه</p>
          <p style="font-size:0.875rem; font-weight:700; color:#fbbf24; font-family:monospace;">${material.min_stock_alert} ${sanitize(material.unit_symbol ?? '')}</p>
        </div>
      ` : ''}
      ${material.unit_cost_syp > 0 ? `
        <div style="background:rgba(30,41,59,0.6); border-radius:10px; padding:0.75rem;">
          <p style="font-size:0.7rem; color:#64748b; margin-bottom:4px;">سعر الوحدة</p>
          <p style="font-size:0.875rem; font-weight:700; color:#4ade80; font-family:monospace;">${formatSYP(material.unit_cost_syp)}</p>
        </div>
        <div style="background:rgba(30,41,59,0.6); border-radius:10px; padding:0.75rem;">
          <p style="font-size:0.7rem; color:#64748b; margin-bottom:4px;">القيمة الإجمالية</p>
          <p style="font-size:0.875rem; font-weight:700; color:#4ade80; font-family:monospace;">${formatSYP(material.current_stock * material.unit_cost_syp)}</p>
        </div>
      ` : ''}
    </div>

    <!-- آخر الحركات -->
    <div>
      <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:0.5rem;">آخر الحركات</p>
      ${txList.length === 0
        ? `<p style="font-size:0.8125rem; color:#475569; text-align:center; padding:1rem 0;">لا توجد حركات بعد</p>`
        : `<div style="display:flex; flex-direction:column; gap:0.375rem;">
            ${txList.slice(0, 6).map(tx => {
              const isIn = tx.type_direction === 1
              return `
                <div style="display:flex; align-items:center; gap:0.75rem; background:rgba(30,41,59,0.4); border-radius:8px; padding:0.5rem 0.75rem;">
                  <span style="font-size:0.75rem; color:#94a3b8; flex:1;">${sanitize(tx.type_label)}</span>
                  <span style="font-family:monospace; font-size:0.8125rem; font-weight:700; color:${isIn ? '#4ade80' : '#f87171'}; direction:ltr;">
                    ${isIn ? '+' : '-'}${Number(tx.quantity).toLocaleString('ar')}
                  </span>
                  <span style="font-size:0.7rem; color:#475569;">${formatDate(tx.created_at)}</span>
                </div>
              `
            }).join('')}
           </div>`
      }
    </div>

    ${!material.is_active && material.archive_reason ? `
      <div class="alert alert-warning">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
        <div>
          <p style="font-weight:700; margin-bottom:2px; font-size:0.8125rem;">سبب الأرشفة</p>
          <p style="font-size:0.75rem;">${sanitize(material.archive_reason)}</p>
          ${material.archived_at ? `<p style="font-size:0.7rem; opacity:0.7; margin-top:2px;">${formatDate(material.archived_at, {withTime:true})}</p>` : ''}
        </div>
      </div>
    ` : ''}
  `

  const { close } = openModal({ title: 'تفاصيل المادة', content, size: 'lg', closable: true })

  content.querySelector('#detail-edit-btn')?.addEventListener('click', () => { close(); onEdit?.() })
}

const editIcon = () => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
