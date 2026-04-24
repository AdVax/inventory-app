/**
 * src/pages/dashboard/dashboard.page.js
 * ──────────────────────────────────────────────────────────────
 * 🏠 لوحة القيادة
 * ──────────────────────────────────────────────────────────────
 */

import { getDashboardSummary }  from '../../services/reports.service.js'
import { store }                from '../../store/store.js'
import { sanitize }             from '../../utils/security.js'
import {
  formatSYP, formatUSD, formatQuantity,
  timeAgo, stockStatusClass, stockStatusIcon,
  txSign, txTypeColor,
} from '../../utils/formatters.js'
import { showPageLoading, showEmptyState } from '../../components/spinner.js'
import { navigate }             from '../../router/router.js'

// ══════════════════════════════════════════════════════════════
export async function render(container) {
  showPageLoading(container, 'جاري تحميل البيانات...')

  const { data, error } = await getDashboardSummary()

  if (error) {
    showEmptyState(container, {
      title: 'تعذّر تحميل البيانات',
      text:  error,
      icon:  errorIcon(),
    })
    return
  }

  const user        = store.getState('user')
  const rate        = store.getState('latestExchangeRate')
  const settings    = store.getState('companySettings')
  const { stock, recent_transactions } = data

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء النور' : 'مساء الخير'
  const firstName = sanitize(user?.full_name?.split(' ')[0] ?? '')

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.5rem;">

      <!-- ── الترحيب ───────────────────────────────────────── -->
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
        <div>
          <h1 style="font-size:1.25rem; font-weight:800; color:#f1f5f9;">
            ${greeting}، ${firstName} 👋
          </h1>
          <p style="color:#64748b; font-size:0.8125rem; margin-top:2px;">
            ${new Date().toLocaleDateString('ar-SY', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        ${rate ? `
          <div style="
            display:flex; align-items:center; gap:0.625rem;
            background:#1e293b; border:1px solid rgba(51,65,85,0.6);
            border-radius:12px; padding:0.5rem 0.875rem;
          ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <div>
              <p style="font-size:0.7rem; color:#64748b; line-height:1;">سعر الدولار</p>
              <p style="font-size:0.875rem; font-weight:700; color:#fbbf24; font-family:monospace; direction:ltr; line-height:1.4;">
                ${Number(rate.usd_to_syp).toLocaleString('ar')} ل.س
              </p>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- ── بطاقات الإحصاء ────────────────────────────────── -->
      <div class="grid-stats">
        ${statCard({ label:'إجمالي المواد',  value: stock.total,         color:'blue',    icon: packageIcon()    })}
        ${statCard({ label:'قيمة المخزون',   value: formatSYP(stock.total_value_syp, {compact:true}), color:'emerald', icon: trendUpIcon(), suffix:'' })}
        ${statCard({ label:'مخزون منخفض',    value: stock.low_count,     color:'amber',   icon: alertIcon(),     alert: stock.low_count > 0 || stock.zero_count > 0 })}
        ${statCard({ label:'نفد المخزون',    value: stock.zero_count,    color:'red',     icon: minusIcon(),     alert: stock.zero_count > 0 })}
      </div>

      <!-- ── المحتوى الرئيسي ────────────────────────────────── -->
      <div style="display:grid; grid-template-columns:1fr; gap:1.25rem;">

        <!-- آخر الحركات -->
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
            <h2 style="font-size:0.875rem; font-weight:700; color:#cbd5e1;">آخر الحركات</h2>
            <button onclick="window.location.hash='/transactions'" style="
              background:none; border:none; cursor:pointer;
              color:#60a5fa; font-size:0.75rem; font-family:inherit;
            ">عرض الكل ←</button>
          </div>

          ${recent_transactions.length === 0
            ? `<div class="card" style="padding:2.5rem; text-align:center;">
                <p style="color:#475569; font-size:0.875rem;">لا توجد حركات بعد</p>
               </div>`
            : `<div class="card" style="padding:0; overflow:hidden;">
                <div style="border-top:1px solid transparent;">
                  ${recent_transactions.map(tx => txRow(tx)).join('')}
                </div>
               </div>`
          }
        </div>

        <!-- تنبيهات المخزون -->
        ${(stock.zero_items.length > 0 || stock.low_items.length > 0) ? `
          <div>
            <h2 style="font-size:0.875rem; font-weight:700; color:#cbd5e1; margin-bottom:0.75rem;">
              ⚠️ تنبيهات المخزون
            </h2>
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              ${[...stock.zero_items, ...stock.low_items].slice(0, 5).map(m => alertCard(m)).join('')}
            </div>
          </div>
        ` : `
          <div class="card" style="text-align:center; padding:2rem;">
            <p style="font-size:1.5rem; margin-bottom:0.5rem;">✅</p>
            <p style="color:#4ade80; font-size:0.875rem; font-weight:600;">جميع المواد في وضع جيد</p>
          </div>
        `}
      </div>

    </div>
  `
}

// ── مكونات مساعدة ────────────────────────────────────────────

function statCard({ label, value, color, icon, suffix = '', alert = false }) {
  const colors = {
    blue:    { text:'#60a5fa',  bg:'rgba(59,130,246,0.1)',  border:'rgba(59,130,246,0.2)'  },
    emerald: { text:'#4ade80',  bg:'rgba(34,197,94,0.1)',   border:'rgba(34,197,94,0.2)'   },
    amber:   { text:'#fbbf24',  bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.2)'  },
    red:     { text:'#f87171',  bg:'rgba(239,68,68,0.1)',   border:'rgba(239,68,68,0.2)'   },
  }
  const c = colors[color] ?? colors.blue

  return `
    <div class="card" style="${alert ? `border-color:${c.border};` : ''}">
      <div style="
        width:2.25rem; height:2.25rem; border-radius:10px;
        background:${c.bg}; border:1px solid ${c.border};
        display:flex; align-items:center; justify-content:center;
        color:${c.text}; margin-bottom:0.75rem;
      ">${icon}</div>
      <p style="font-size:1.5rem; font-weight:800; color:${c.text}; font-family:monospace; line-height:1.2;">
        ${sanitize(String(value))}${suffix}
      </p>
      <p style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">${label}</p>
    </div>
  `
}

function txRow(tx) {
  const isIn   = tx.type_direction === 1
  const color  = isIn ? '#4ade80' : '#f87171'
  const bgIcon = isIn ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'
  const arrowSvg = isIn
    ? `<path d="M12 5v14m-7-7l7 7 7-7"/>`
    : `<path d="M12 19V5m7 7-7-7-7 7"/>`

  return `
    <div style="
      display:flex; align-items:center; gap:0.75rem;
      padding:0.75rem 1rem;
      border-bottom:1px solid rgba(51,65,85,0.3);
      transition:background 0.15s;
    " onmouseenter="this.style.background='rgba(51,65,85,0.2)'"
       onmouseleave="this.style.background='transparent'">

      <div style="
        width:2rem; height:2rem; border-radius:8px; flex-shrink:0;
        background:${bgIcon}; display:flex; align-items:center; justify-content:center; color:${color};
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${arrowSvg}</svg>
      </div>

      <div style="flex:1; min-width:0;">
        <p style="font-size:0.8125rem; font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${sanitize(tx.material_name)}
        </p>
        <p style="font-size:0.7rem; color:#64748b; margin-top:1px;">${sanitize(tx.type_label)}</p>
      </div>

      <div style="text-align:left; flex-shrink:0;">
        <p style="font-size:0.875rem; font-weight:700; color:${color}; font-family:monospace; direction:ltr;">
          ${isIn ? '+' : '-'}${Number(tx.quantity).toLocaleString('ar')}
        </p>
        <p style="font-size:0.7rem; color:#475569; direction:ltr;">${timeAgo(tx.created_at)}</p>
      </div>
    </div>
  `
}

function alertCard(m) {
  const isZero = m.current_stock === 0
  const color  = isZero ? '#f87171' : '#fbbf24'
  const bg     = isZero ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'
  const border = isZero ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'

  return `
    <div style="
      background:${bg}; border:1px solid ${border};
      border-radius:10px; padding:0.75rem;
      display:flex; align-items:center; justify-content:space-between; gap:0.5rem;
    ">
      <p style="font-size:0.8125rem; font-weight:600; color:${color}; flex:1; min-width:0;
                white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${isZero ? '⛔' : '⚠️'} ${sanitize(m.name)}
      </p>
      <span style="
        font-size:0.7rem; font-weight:700; color:${color};
        font-family:monospace; white-space:nowrap; direction:ltr;
      ">${Number(m.current_stock).toLocaleString('ar')} ${sanitize(m.unit_symbol ?? '')}</span>
    </div>
  `
}

// ── SVG Icons ────────────────────────────────────────────────
const svg = (path) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${path}</svg>`
const packageIcon  = () => svg('<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>')
const trendUpIcon  = () => svg('<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>')
const alertIcon    = () => svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>')
const minusIcon    = () => svg('<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>')
const errorIcon    = () => svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>')
