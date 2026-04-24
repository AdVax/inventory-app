/**
 * src/pages/reports/reports.page.js
 * ──────────────────────────────────────────────────────────────
 * 📊 صفحة التقارير
 * ──────────────────────────────────────────────────────────────
 */

import { getInventoryReport, getMovementsReport } from '../../services/reports.service.js'
import { store }           from '../../store/store.js'
import { sanitize }        from '../../utils/security.js'
import {
  formatSYP, formatUSD, formatQuantity, formatDate,
  stockStatusClass, stockStatusLabel, stockStatus,
  daysAgoISO, todayISO,
} from '../../utils/formatters.js'
import { showPageLoading, showEmptyState } from '../../components/spinner.js'

// ══════════════════════════════════════════════════════════════
export async function render(container) {
  let activeTab  = 'inventory'
  let dateFrom   = daysAgoISO(30)
  let dateTo     = todayISO()

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">

      <!-- الهيدر -->
      <div class="page-header">
        <div>
          <h1 class="page-title">التقارير</h1>
          <p class="page-subtitle">تحليل شامل للمخزون والحركات</p>
        </div>
        <!-- نطاق التاريخ (للحركات فقط) -->
        <div id="date-range-controls" style="display:none; align-items:center; gap:0.5rem; flex-wrap:wrap;">
          <input id="date-from" type="date" class="form-input ltr" style="width:140px; font-size:0.8125rem; padding:0.4rem 0.625rem;" value="${dateFrom}" dir="ltr" />
          <span style="color:#475569; font-size:0.8125rem;">إلى</span>
          <input id="date-to" type="date" class="form-input ltr" style="width:140px; font-size:0.8125rem; padding:0.4rem 0.625rem;" value="${dateTo}" dir="ltr" />
          <button id="apply-dates-btn" class="btn btn-primary btn-sm">تطبيق</button>
        </div>
      </div>

      <!-- التبويبات -->
      <div class="tabs-container">
        <button class="tab-btn active" data-tab="inventory">${packageIcon()} المخزون</button>
        <button class="tab-btn" data-tab="movements">${chartIcon()} الحركات</button>
        <button class="tab-btn" data-tab="valuation">${dollarIcon()} التقييم</button>
      </div>

      <!-- محتوى التقرير -->
      <div id="report-content"></div>
    </div>
  `

  async function loadReport() {
    const reportContent = container.querySelector('#report-content')
    showPageLoading(reportContent, 'جاري إعداد التقرير...')

    const dateControls = container.querySelector('#date-range-controls')
    if (dateControls) dateControls.style.display = activeTab === 'movements' ? 'flex' : 'none'

    if (activeTab === 'inventory' || activeTab === 'valuation') {
      const { data, error } = await getInventoryReport()
      if (error) { showEmptyState(reportContent, { title: 'تعذّر تحميل التقرير', text: error }); return }
      activeTab === 'inventory' ? renderInventory(reportContent, data) : renderValuation(reportContent, data)
    } else {
      const { data, error } = await getMovementsReport(dateFrom, dateTo)
      if (error) { showEmptyState(reportContent, { title: 'تعذّر تحميل التقرير', text: error }); return }
      renderMovements(reportContent, data)
    }
  }

  // ── تقرير المخزون ─────────────────────────────────────────
  function renderInventory(el, items) {
    if (!items?.length) { showEmptyState(el, { title: 'لا توجد مواد نشطة' }); return }

    const totalSYP = items.reduce((s, m) => s + m.total_value_syp, 0)
    const zero     = items.filter(m => m.stock_status === 'zero').length
    const low      = items.filter(m => m.stock_status === 'low').length

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <!-- ملخص -->
        <div class="grid-stats">
          ${[
            { label:'إجمالي المواد',   value: items.length, color:'#60a5fa' },
            { label:'قيمة المخزون',    value: formatSYP(totalSYP, {compact:true}), color:'#4ade80' },
            { label:'مخزون صفري',      value: zero, color:'#f87171' },
            { label:'مخزون منخفض',     value: low,  color:'#fbbf24' },
          ].map(s => `
            <div class="card" style="text-align:right;">
              <p style="font-size:1.375rem; font-weight:800; color:${s.color}; font-family:monospace;">${s.value}</p>
              <p style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${s.label}</p>
            </div>
          `).join('')}
        </div>

        <!-- الجدول -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="overflow-table">
            <table class="data-table">
              <thead>
                <tr><th>المادة</th><th>الوحدة</th><th>الكمية</th><th>السعر (ل.س)</th><th>الإجمالي (ل.س)</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                ${items.map(m => `
                  <tr>
                    <td>
                      <p style="font-weight:600; color:#e2e8f0;">${sanitize(m.name)}</p>
                      ${m.code ? `<p style="font-size:0.7rem; color:#475569; font-family:monospace;">${sanitize(m.code)}</p>` : ''}
                    </td>
                    <td style="color:#94a3b8; font-size:0.8125rem;">${sanitize(m.unit_name)}</td>
                    <td style="font-family:monospace; font-weight:600; color:#e2e8f0; direction:ltr;">${formatQuantity(m.current_stock)} ${sanitize(m.unit_symbol ?? '')}</td>
                    <td style="font-family:monospace; font-size:0.8125rem; color:#94a3b8;">${m.unit_cost_syp > 0 ? formatSYP(m.unit_cost_syp) : '—'}</td>
                    <td style="font-family:monospace; font-weight:700; color:#4ade80;">${m.total_value_syp > 0 ? formatSYP(m.total_value_syp) : '—'}</td>
                    <td><span class="stock-badge ${stockStatusClass(m.stock_status)}">${stockStatusLabel(m.stock_status)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="font-weight:800; color:#e2e8f0; padding:0.75rem 1rem;">الإجمالي</td>
                  <td style="font-family:monospace; font-weight:800; color:#4ade80; padding:0.75rem 1rem;">${formatSYP(totalSYP)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `
  }

  // ── تقرير الحركات ─────────────────────────────────────────
  function renderMovements(el, data) {
    if (!data) { showEmptyState(el, { title: 'لا توجد بيانات' }); return }

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <!-- ملخص -->
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:0.75rem;">
          ${[
            { label:'إجمالي الحركات', value: data.total,                        color:'#60a5fa' },
            { label:'عمليات إدخال',   value: data.by_type?.stock_in      ?? 0,   color:'#4ade80' },
            { label:'عمليات إخراج',   value: data.by_type?.stock_out     ?? 0,   color:'#f87171' },
          ].map(s => `
            <div class="card" style="text-align:right;">
              <p style="font-size:1.5rem; font-weight:800; color:${s.color}; font-family:monospace;">${s.value}</p>
              <p style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${s.label}</p>
            </div>
          `).join('')}
        </div>

        <!-- رسم بياني نصي (بسيط) -->
        ${data.chart_data?.length > 0 ? `
          <div class="card">
            <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:0.875rem;">الحركات اليومية</p>
            <div style="display:flex; flex-direction:column; gap:0.375rem; max-height:280px; overflow-y:auto;">
              ${data.chart_data.slice(-14).map(d => {
                const maxVal  = Math.max(...data.chart_data.map(x => Math.max(x.in, x.out)), 1)
                const inPct   = Math.round((d.in  / maxVal) * 100)
                const outPct  = Math.round((d.out / maxVal) * 100)
                return `
                  <div style="display:flex; align-items:center; gap:0.625rem; font-size:0.75rem;">
                    <span style="color:#64748b; width:70px; flex-shrink:0; direction:ltr;">${d.date}</span>
                    <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
                      ${d.in  > 0 ? `<div style="height:8px; width:${inPct}%; background:#22c55e; border-radius:4px; min-width:4px;" title="وارد: ${d.in}"></div>` : ''}
                      ${d.out > 0 ? `<div style="height:8px; width:${outPct}%; background:#ef4444; border-radius:4px; min-width:4px;" title="صادر: ${d.out}"></div>` : ''}
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-shrink:0; font-family:monospace;">
                      ${d.in  > 0 ? `<span style="color:#4ade80;">+${d.in.toLocaleString('ar')}</span>` : ''}
                      ${d.out > 0 ? `<span style="color:#f87171;">-${d.out.toLocaleString('ar')}</span>` : ''}
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- أكثر المواد نشاطاً -->
        ${data.top_materials?.length > 0 ? `
          <div class="card">
            <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:0.875rem;">أكثر المواد نشاطاً</p>
            <div style="display:flex; flex-direction:column; gap:0.625rem;">
              ${data.top_materials.map((m, i) => {
                const maxCount = data.top_materials[0].count
                const pct      = Math.round((m.count / maxCount) * 100)
                return `
                  <div style="display:flex; align-items:center; gap:0.625rem;">
                    <span style="font-size:0.75rem; color:#475569; width:1.25rem; flex-shrink:0;">${i+1}</span>
                    <div style="flex:1; min-width:0;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                        <span style="font-size:0.8125rem; font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${sanitize(m.name)}</span>
                        <span style="font-size:0.75rem; color:#64748b; flex-shrink:0; margin-right:0.5rem;">${m.count} حركة</span>
                      </div>
                      <div style="height:5px; background:rgba(51,65,85,0.6); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:#3b82f6; border-radius:3px;"></div>
                      </div>
                      <div style="display:flex; gap:0.75rem; margin-top:3px; font-size:0.7rem; font-family:monospace;">
                        <span style="color:#4ade80;">↓ ${m.in_qty.toLocaleString('ar')}</span>
                        <span style="color:#f87171;">↑ ${m.out_qty.toLocaleString('ar')}</span>
                      </div>
                    </div>
                  </div>
                `
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  // ── تقرير التقييم ─────────────────────────────────────────
  function renderValuation(el, items) {
    const withStock = items.filter(m => m.current_stock > 0)
    if (!withStock.length) { showEmptyState(el, { title: 'لا توجد مواد بمخزون حالي' }); return }

    const totalSYP = withStock.reduce((s, m) => s + m.total_value_syp, 0)
    const totalUSD = withStock.reduce((s, m) => s + m.total_value_usd, 0)

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <!-- ملخص -->
        <div class="card" style="background:linear-gradient(135deg,rgba(37,99,235,0.1),rgba(109,40,217,0.05)); border-color:rgba(59,130,246,0.2);">
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1rem;">
            <div>
              <p style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">عدد المواد</p>
              <p style="font-size:1.5rem; font-weight:800; color:#e2e8f0; font-family:monospace;">${withStock.length}</p>
            </div>
            <div>
              <p style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">إجمالي القيمة (ل.س)</p>
              <p style="font-size:1.125rem; font-weight:800; color:#4ade80; font-family:monospace;">${formatSYP(totalSYP, {compact:true})}</p>
            </div>
            <div>
              <p style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">إجمالي القيمة ($)</p>
              <p style="font-size:1.125rem; font-weight:800; color:#60a5fa; font-family:monospace;">${formatUSD(totalUSD)}</p>
            </div>
          </div>
        </div>

        <!-- الجدول -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div class="overflow-table">
            <table class="data-table">
              <thead>
                <tr><th>#</th><th>المادة</th><th>الكمية</th><th>سعر الوحدة (ل.س)</th><th>القيمة (ل.س)</th><th>القيمة ($)</th></tr>
              </thead>
              <tbody>
                ${withStock.map((m, i) => `
                  <tr>
                    <td style="color:#475569; font-size:0.75rem;">${i+1}</td>
                    <td>
                      <p style="font-weight:600; color:#e2e8f0;">${sanitize(m.name)}</p>
                      ${m.code ? `<p style="font-size:0.7rem; color:#475569; font-family:monospace;">${sanitize(m.code)}</p>` : ''}
                    </td>
                    <td style="font-family:monospace; color:#e2e8f0; direction:ltr;">${formatQuantity(m.current_stock)} ${sanitize(m.unit_symbol ?? '')}</td>
                    <td style="font-family:monospace; font-size:0.8125rem; color:#94a3b8;">${m.unit_cost_syp > 0 ? formatSYP(m.unit_cost_syp) : '—'}</td>
                    <td style="font-family:monospace; font-weight:700; color:#4ade80;">${m.total_value_syp > 0 ? formatSYP(m.total_value_syp) : '—'}</td>
                    <td style="font-family:monospace; font-weight:700; color:#60a5fa;">${m.total_value_usd > 0 ? formatUSD(m.total_value_usd) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="font-weight:800; color:#e2e8f0; padding:0.75rem 1rem;">الإجمالي</td>
                  <td style="font-family:monospace; font-weight:800; color:#4ade80; padding:0.75rem 1rem;">${formatSYP(totalSYP)}</td>
                  <td style="font-family:monospace; font-weight:800; color:#60a5fa; padding:0.75rem 1rem;">${formatUSD(totalUSD)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `
  }

  // ── ربط التبويبات ─────────────────────────────────────────
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      activeTab = btn.dataset.tab
      loadReport()
    })
  })

  container.querySelector('#apply-dates-btn')?.addEventListener('click', () => {
    dateFrom = container.querySelector('#date-from')?.value || daysAgoISO(30)
    dateTo   = container.querySelector('#date-to')?.value   || todayISO()
    loadReport()
  })

  await loadReport()
}

const svg = (p) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`
const packageIcon = () => svg('<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>')
const chartIcon   = () => svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>')
const dollarIcon  = () => svg('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')
