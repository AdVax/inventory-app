/**
 * src/pages/materials/materials.page.js
 * ──────────────────────────────────────────────────────────────
 * 📦 صفحة إدارة المواد والمخزون
 * ──────────────────────────────────────────────────────────────
 */

import { getMaterials, archiveMaterial } from '../../services/materials.service.js'
import {
  store, selectIsAdmin,
  setMaterialsCache, isMaterialsCacheValid, invalidateMaterialsCache,
} from '../../store/store.js'
import { sanitize }           from '../../utils/security.js'
import { formatQuantity, stockStatus, stockStatusClass } from '../../utils/formatters.js'
import { showTableSkeleton, showEmptyState } from '../../components/spinner.js'
import { toast }              from '../../components/toast.js'
import { confirmArchive }     from '../../components/confirmDialog.js'
import { openMaterialForm }   from './materialForm.js'

// ══════════════════════════════════════════════════════════════
// حالة الصفحة
// ══════════════════════════════════════════════════════════════
let _state = {
  materials:    [],
  filtered:     [],
  search:       '',
  filterStatus: 'all',
  showArchived: false,
}
let _container = null

// ══════════════════════════════════════════════════════════════
export async function render(container) {
  _container = container
  _state     = { materials:[], filtered:[], search:'', filterStatus:'all', showArchived:false }

  container.innerHTML = buildShell()
  bindShellEvents()
  await loadMaterials()

  return () => { _container = null }
}

// ══════════════════════════════════════════════════════════════
async function loadMaterials(force = false) {
  if (!_container) return

  // استخدام Cache
  if (!force && isMaterialsCacheValid() && !_state.showArchived) {
    _state.materials = store.getState('materialsCache') ?? []
    applyFilters(); renderTable(); updateStats(); return
  }

  const listEl = _container.querySelector('#mat-list')
  if (listEl) showTableSkeleton(listEl, 5, 6)

  const { data, error } = await getMaterials({ includeArchived: _state.showArchived })
  if (error) { toast.error(error); return }

  _state.materials = data ?? []
  if (!_state.showArchived) setMaterialsCache(_state.materials)
  applyFilters(); renderTable(); updateStats()
}

function applyFilters() {
  const q = _state.search.trim().toLowerCase()
  _state.filtered = _state.materials.filter(m => {
    const matchSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      (m.code ?? '').toLowerCase().includes(q)
    const st = stockStatus(m.current_stock, m.min_stock_alert)
    const matchFilter = _state.filterStatus === 'all' ? true : st === _state.filterStatus
    return matchSearch && matchFilter
  })
}

// ══════════════════════════════════════════════════════════════
function buildShell() {
  const isAdmin = selectIsAdmin()
  return `
  <div style="display:flex;flex-direction:column;gap:1.25rem;">
    <!-- الهيدر -->
    <div class="page-header">
      <div>
        <h1 class="page-title">المواد والمخزون</h1>
        <p class="page-subtitle" id="mat-subtitle">جاري التحميل...</p>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <button id="mat-refresh" class="btn btn-ghost btn-sm" title="تحديث">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
        ${isAdmin ? `<button id="mat-add" class="btn btn-primary btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>إضافة مادة</button>` : ''}
      </div>
    </div>

    <!-- إحصاء سريع -->
    <div class="grid-stats" id="mat-stats">
      ${['all','ok','low','zero'].map(f => `
        <div class="stat-card ${_state.filterStatus===f?'active-filter':''}" data-filter="${f}" id="stat-${f}" style="cursor:pointer;">
          <p style="font-size:1.5rem;font-weight:800;font-family:monospace;color:#f1f5f9;">—</p>
          <p style="font-size:0.75rem;color:#94a3b8;margin-top:2px;">${{all:'الكل',ok:'جيد',low:'منخفض',zero:'نفد'}[f]}</p>
        </div>`).join('')}
    </div>

    <!-- شريط بحث -->
    <div style="display:flex;gap:0.625rem;flex-wrap:wrap;">
      <div class="search-wrapper" style="flex:1;min-width:180px;">
        <span class="search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input id="mat-search" class="search-input" placeholder="بحث بالاسم أو الرمز..." />
      </div>
      <button id="mat-toggle-archive" class="btn btn-ghost btn-sm">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
        عرض المؤرشف
      </button>
    </div>

    <!-- قائمة المواد -->
    <div id="mat-list"></div>
  </div>`
}

// ══════════════════════════════════════════════════════════════
function updateStats() {
  if (!_container) return
  const all  = _state.materials
  const zero = all.filter(m => m.current_stock === 0).length
  const low  = all.filter(m => m.min_stock_alert != null && m.current_stock > 0 && m.current_stock <= m.min_stock_alert).length
  const ok   = all.filter(m => m.current_stock > 0 && (m.min_stock_alert == null || m.current_stock > m.min_stock_alert)).length

  const map = { all: all.length, ok, low, zero }
  const clr = { all:'#60a5fa', ok:'#4ade80', low:'#fbbf24', zero:'#f87171' }
  Object.entries(map).forEach(([f,c]) => {
    const el = _container.querySelector(`#stat-${f} p:first-child`)
    if (el) { el.textContent = c; el.style.color = clr[f] }
  })
  const sub = _container.querySelector('#mat-subtitle')
  if (sub) sub.textContent = `${all.length} مادة · ${zero} نفد · ${low} منخفض`
}

// ══════════════════════════════════════════════════════════════
function renderTable() {
  const listEl = _container?.querySelector('#mat-list')
  if (!listEl) return

  if (_state.filtered.length === 0) {
    showEmptyState(listEl, {
      title: _state.search ? 'لا توجد نتائج' : 'لا توجد مواد',
      text:  _state.search ? 'جرّب تغيير كلمة البحث' : '',
      action: selectIsAdmin() && !_state.search
        ? `<button class="btn btn-primary btn-sm" onclick="document.getElementById('mat-add')?.click()">+ إضافة أول مادة</button>`
        : '',
    })
    return
  }

  const isAdmin = selectIsAdmin()

  listEl.innerHTML = `
    <!-- Desktop -->
    <div class="card hide-mobile" style="padding:0;overflow:hidden;">
      <div class="overflow-table">
        <table class="data-table">
          <thead><tr>
            <th>الرمز</th><th>اسم المادة</th><th>الوحدة</th>
            <th>المخزون</th><th>الحالة</th>
            ${isAdmin ? '<th>إجراءات</th>' : ''}
          </tr></thead>
          <tbody>${_state.filtered.map(m => buildRow(m, isAdmin)).join('')}</tbody>
        </table>
      </div>
    </div>
    <!-- Mobile -->
    <div style="display:flex;flex-direction:column;gap:0.625rem;" class="show-mobile">
      ${_state.filtered.map(m => buildCard(m, isAdmin)).join('')}
    </div>
  `
  bindRowActions()
}

function buildRow(m, isAdmin) {
  const st    = stockStatus(m.current_stock, m.min_stock_alert)
  const stCls = stockStatusClass(st)
  const stLbl = { zero:'نفد', low:'منخفض', ok:'جيد' }[st]
  const bCls  = { zero:'badge-danger', low:'badge-warning', ok:'badge-success' }[st]

  return `
  <tr class="${!m.is_active?'opacity-50':''}" style="cursor:default;">
    <td style="font-family:monospace;font-size:0.75rem;color:#64748b;">${sanitize(m.code??'—')}</td>
    <td><p style="font-weight:600;color:#e2e8f0;">${sanitize(m.name)}</p>${m.description?`<p style="font-size:0.7rem;color:#475569;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sanitize(m.description)}</p>`:''}</td>
    <td><span class="badge badge-default">${sanitize(m.unit_symbol??'—')}</span></td>
    <td><span class="stock-badge ${stCls}">${formatQuantity(m.current_stock,m.unit_symbol)}</span></td>
    <td><span class="badge ${bCls}">${stLbl}</span></td>
    ${isAdmin?`<td><div style="display:flex;gap:0.25rem;">
      ${m.is_active?`
        <button class="edit-btn" data-id="${m.id}" style="padding:0.3rem;border-radius:6px;background:rgba(59,130,246,0.1);color:#60a5fa;border:none;cursor:pointer;" title="تعديل">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="archive-btn" data-id="${m.id}" data-name="${sanitize(m.name)}" data-stock="${m.current_stock}" data-unit="${sanitize(m.unit_symbol??'')}"
          style="padding:0.3rem;border-radius:6px;background:rgba(245,158,11,0.1);color:#fbbf24;border:none;cursor:pointer;" title="أرشفة">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
        </button>
      `:`<span style="font-size:0.7rem;color:#475569;">مؤرشفة</span>`}
    </div></td>`:``}
  </tr>`
}

function buildCard(m, isAdmin) {
  const st    = stockStatus(m.current_stock, m.min_stock_alert)
  const stCls = stockStatusClass(st)
  return `
  <div class="mobile-card ${!m.is_active?'opacity-50':''}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:0.5rem;">
      <div><p style="font-weight:700;color:#e2e8f0;font-size:0.875rem;">${sanitize(m.name)}</p>
        ${m.code?`<p style="font-size:0.7rem;color:#475569;font-family:monospace;">${sanitize(m.code)}</p>`:''}</div>
      <span class="badge ${m.is_active?'badge-success':'badge-default'}">${m.is_active?'نشطة':'مؤرشفة'}</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span class="stock-badge ${stCls}">${formatQuantity(m.current_stock,m.unit_symbol)}</span>
      <span class="badge badge-default">${sanitize(m.unit_name??'—')}</span>
    </div>
    ${isAdmin&&m.is_active?`
    <div style="display:flex;gap:0.5rem;margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(51,65,85,0.4);">
      <button class="edit-btn" data-id="${m.id}" style="flex:1;font-size:0.75rem;color:#60a5fa;background:none;border:none;cursor:pointer;font-family:inherit;">تعديل</button>
      <button class="archive-btn" data-id="${m.id}" data-name="${sanitize(m.name)}" data-stock="${m.current_stock}" data-unit="${sanitize(m.unit_symbol??'')}"
        style="flex:1;font-size:0.75rem;color:#fbbf24;background:none;border:none;cursor:pointer;font-family:inherit;">أرشفة</button>
    </div>`:``}
  </div>`
}

// ══════════════════════════════════════════════════════════════
function bindShellEvents() {
  if (!_container) return

  _container.querySelector('#mat-search')?.addEventListener('input', e => {
    _state.search = e.target.value; applyFilters(); renderTable()
  })

  _container.querySelector('#mat-stats')?.addEventListener('click', e => {
    const card = e.target.closest('[data-filter]')
    if (!card) return
    _state.filterStatus = card.dataset.filter
    _container.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active-filter'))
    card.classList.add('active-filter')
    applyFilters(); renderTable()
  })

  _container.querySelector('#mat-refresh')?.addEventListener('click', () => {
    invalidateMaterialsCache(); loadMaterials(true)
  })

  _container.querySelector('#mat-add')?.addEventListener('click', () => {
    openMaterialForm({ onSuccess: () => { invalidateMaterialsCache(); loadMaterials(true) } })
  })

  _container.querySelector('#mat-toggle-archive')?.addEventListener('click', e => {
    _state.showArchived = !_state.showArchived
    const btn = e.currentTarget
    btn.querySelector('svg').nextSibling.textContent = _state.showArchived ? ' إخفاء المؤرشف' : ' عرض المؤرشف'
    btn.style.color = _state.showArchived ? '#fbbf24' : ''
    loadMaterials(true)
  })
}

function bindRowActions() {
  if (!_container) return

  _container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mat = _state.materials.find(m => m.id === btn.dataset.id)
      if (mat) openMaterialForm({ material: mat, onSuccess: () => { invalidateMaterialsCache(); loadMaterials(true) } })
    })
  })

  _container.querySelectorAll('.archive-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmArchive({
        itemName:   btn.dataset.name,
        stockQty:   Number(btn.dataset.stock),
        unitSymbol: btn.dataset.unit,
        onConfirm:  async (reason) => {
          const { error } = await archiveMaterial(btn.dataset.id, reason, store.getState('user').id)
          if (error) { toast.error(error); throw new Error(error) }
          toast.success('تمت الأرشفة بنجاح')
          invalidateMaterialsCache(); await loadMaterials(true)
        },
      })
    })
  })
}
