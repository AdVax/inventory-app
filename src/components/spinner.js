/**
 * src/components/spinner.js
 * ──────────────────────────────────────────────────────────────
 * ⏳ مكونات مؤشرات التحميل
 *
 * توفر:
 * 1. createSpinner()       - دوّامة بسيطة
 * 2. createLoadingScreen() - شاشة تحميل كاملة
 * 3. createSkeletonRow()   - صف وهمي للجداول (Skeleton)
 * 4. showPageLoading()     - عرض تحميل داخل container
 * 5. showTableSkeleton()   - هيكل جدول وهمي أثناء التحميل
 * ──────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
// 🌀 1. Spinner بسيط
// ══════════════════════════════════════════════════════════════

/**
 * إنشاء عنصر Spinner
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {string} [color] - CSS color (اختياري)
 * @returns {HTMLElement}
 */
export function createSpinner(size = 'md', color = null) {
  const el = document.createElement('div')
  el.className = `spinner spinner-${size}`
  el.setAttribute('role', 'status')
  el.setAttribute('aria-label', 'جاري التحميل')
  if (color) el.style.borderTopColor = color
  return el
}

// ══════════════════════════════════════════════════════════════
// 📺 2. شاشة تحميل كاملة
// ══════════════════════════════════════════════════════════════

/**
 * إنشاء شاشة تحميل مع نص اختياري
 *
 * @param {string} [text='جاري التحميل...']
 * @param {string} [subtext]
 * @returns {HTMLElement}
 */
export function createLoadingScreen(text = 'جاري التحميل...', subtext = '') {
  const el = document.createElement('div')
  el.className = 'loading-screen'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')

  el.innerHTML = `
    <div style="position:relative; width:3.5rem; height:3.5rem; flex-shrink:0;">
      <div style="
        position:absolute; inset:0;
        border:3px solid rgba(51,65,85,0.7);
        border-radius:50%;
      "></div>
      <div style="
        position:absolute; inset:0;
        border:3px solid transparent;
        border-top-color:#3b82f6;
        border-radius:50%;
        animation:spin 0.7s linear infinite;
      "></div>
      <div style="
        position:absolute; inset:0.5rem;
        background:rgba(59,130,246,0.08);
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      </div>
    </div>
    ${text    ? `<p style="color:#94a3b8; font-size:0.875rem; font-weight:500; margin-top:0.5rem;">${text}</p>` : ''}
    ${subtext ? `<p style="color:#475569; font-size:0.75rem;">${subtext}</p>` : ''}
  `

  return el
}

// ══════════════════════════════════════════════════════════════
// 💀 3. Skeleton Loaders
// ══════════════════════════════════════════════════════════════

/** CSS لأنيميشن الـ Skeleton — يُضاف مرة واحدة فقط */
let skeletonStyleAdded = false
function ensureSkeletonStyle() {
  if (skeletonStyleAdded) return
  skeletonStyleAdded = true

  const style = document.createElement('style')
  style.textContent = `
    .skeleton {
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 6px;
    }
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `
  document.head.appendChild(style)
}

/**
 * إنشاء مستطيل Skeleton
 * @param {string} [width='100%']
 * @param {string} [height='1rem']
 * @returns {HTMLElement}
 */
export function createSkeleton(width = '100%', height = '1rem') {
  ensureSkeletonStyle()
  const el = document.createElement('div')
  el.className = 'skeleton'
  el.setAttribute('aria-hidden', 'true')
  el.style.width  = width
  el.style.height = height
  return el
}

/**
 * إنشاء صف Skeleton لجدول البيانات
 * @param {number} [cols=6] - عدد الأعمدة
 * @returns {HTMLElement} <tr>
 */
export function createSkeletonRow(cols = 6) {
  ensureSkeletonStyle()
  const tr = document.createElement('tr')

  for (let i = 0; i < cols; i++) {
    const td = document.createElement('td')
    td.style.padding = '0.75rem 1rem'
    td.setAttribute('aria-hidden', 'true')

    const sk = createSkeleton(
      i === 0 ? '60px' : i === cols - 1 ? '80px' : `${60 + Math.random() * 40}%`,
      '0.875rem'
    )
    td.appendChild(sk)
    tr.appendChild(td)
  }

  return tr
}

/**
 * إنشاء جدول Skeleton كامل
 * @param {number} [rows=5]
 * @param {number} [cols=6]
 * @returns {HTMLElement}
 */
export function createTableSkeleton(rows = 5, cols = 6) {
  const wrapper = document.createElement('div')
  wrapper.className = 'card'
  wrapper.style.padding = '0'
  wrapper.style.overflow = 'hidden'

  const table = document.createElement('table')
  table.className = 'data-table'
  table.setAttribute('aria-label', 'جاري تحميل البيانات')

  const tbody = document.createElement('tbody')
  tbody.className = 'divide-y'

  for (let i = 0; i < rows; i++) {
    tbody.appendChild(createSkeletonRow(cols))
  }

  table.appendChild(tbody)
  wrapper.appendChild(table)
  return wrapper
}

/**
 * إنشاء بطاقات Skeleton للموبايل
 * @param {number} [count=4]
 * @returns {HTMLElement}
 */
export function createCardsSkeleton(count = 4) {
  const wrapper = document.createElement('div')
  wrapper.style.display = 'flex'
  wrapper.style.flexDirection = 'column'
  wrapper.style.gap = '0.75rem'

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div')
    card.className = 'card'

    card.innerHTML = `
      <div style="display:flex; gap:0.75rem; align-items:flex-start; margin-bottom:0.75rem;">
        <div class="skeleton" style="width:2.5rem; height:2.5rem; border-radius:8px; flex-shrink:0;" aria-hidden="true"></div>
        <div style="flex:1; display:flex; flex-direction:column; gap:0.4rem;">
          <div class="skeleton" style="width:60%; height:0.875rem;" aria-hidden="true"></div>
          <div class="skeleton" style="width:40%; height:0.75rem;" aria-hidden="true"></div>
        </div>
        <div class="skeleton" style="width:60px; height:1.25rem; border-radius:6px;" aria-hidden="true"></div>
      </div>
      <div style="display:flex; gap:0.5rem; padding-top:0.75rem; border-top:1px solid rgba(51,65,85,0.4);">
        <div class="skeleton" style="width:30%; height:0.75rem;" aria-hidden="true"></div>
        <div class="skeleton" style="width:25%; height:0.75rem;" aria-hidden="true"></div>
      </div>
    `
    ensureSkeletonStyle()
    wrapper.appendChild(card)
  }

  return wrapper
}

// ══════════════════════════════════════════════════════════════
// 🎯 4. دوال عرض مباشرة في Container
// ══════════════════════════════════════════════════════════════

/**
 * عرض شاشة تحميل داخل container
 * @param {HTMLElement} container
 * @param {string} [text]
 */
export function showPageLoading(container, text = 'جاري التحميل...') {
  if (!container) return
  container.innerHTML = ''
  container.appendChild(createLoadingScreen(text))
}

/**
 * عرض جدول Skeleton داخل container
 * @param {HTMLElement} container
 * @param {number} [rows=5]
 * @param {number} [cols=6]
 */
export function showTableSkeleton(container, rows = 5, cols = 6) {
  if (!container) return
  container.innerHTML = ''

  // Skeleton للـ Desktop (جدول)
  const desktopEl = document.createElement('div')
  desktopEl.className = 'hide-mobile'
  desktopEl.appendChild(createTableSkeleton(rows, cols))

  // Skeleton للـ Mobile (بطاقات)
  const mobileEl = document.createElement('div')
  mobileEl.className = 'show-mobile'
  mobileEl.style.display = 'none'
  mobileEl.appendChild(createCardsSkeleton(Math.min(rows, 4)))

  container.appendChild(desktopEl)
  container.appendChild(mobileEl)
}

/**
 * عرض Empty State (لا توجد بيانات)
 * @param {HTMLElement} container
 * @param {object} options
 * @param {string} [options.title='لا توجد بيانات']
 * @param {string} [options.text]
 * @param {string} [options.icon]    - SVG string
 * @param {string} [options.action]  - HTML زر
 */
export function showEmptyState(container, {
  title  = 'لا توجد بيانات',
  text   = '',
  icon   = null,
  action = '',
} = {}) {
  if (!container) return

  const defaultIcon = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.5">
      <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
    </svg>
  `

  const el = document.createElement('div')
  el.className = 'empty-state'
  el.innerHTML = `
    <div class="empty-state-icon">${icon ?? defaultIcon}</div>
    <p class="empty-state-title">${title}</p>
    ${text   ? `<p class="empty-state-text">${text}</p>`  : ''}
    ${action ? `<div style="margin-top:1rem;">${action}</div>` : ''}
  `

  container.innerHTML = ''
  container.appendChild(el)
}

export default {
  createSpinner,
  createLoadingScreen,
  createSkeleton,
  createSkeletonRow,
  createTableSkeleton,
  createCardsSkeleton,
  showPageLoading,
  showTableSkeleton,
  showEmptyState,
}
