/**
 * src/pages/settings/settings.page.js
 * ──────────────────────────────────────────────────────────────
 * ⚙️ صفحة الإعدادات (Admin فقط)
 * تشمل: بيانات الشركة / سعر الصرف / الوحدات / سجل الأسعار
 * ──────────────────────────────────────────────────────────────
 */

import { getCompanySettings, updateCompanySettings, createExchangeRate, getExchangeRateHistory, getLatestExchangeRate } from '../../services/settings.service.js'
import { getUnits, createUnit, toggleUnitActive } from '../../services/units.service.js'
import { store, setCompanySettings, setLatestExchangeRate } from '../../store/store.js'
import { sanitize }        from '../../utils/security.js'
import { formatDate, formatSYP } from '../../utils/formatters.js'
import { companySettingsSchema, exchangeRateSchema, unitSchema, showFormErrors, clearFormErrors } from '../../utils/validators.js'
import { toast }           from '../../components/toast.js'
import { confirmToggleActive } from '../../components/confirmDialog.js'
import { showPageLoading } from '../../components/spinner.js'

// ══════════════════════════════════════════════════════════════
export async function render(container) {
  let activeTab = 'company'

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.25rem;">
      <div class="page-header">
        <div>
          <h1 class="page-title">الإعدادات</h1>
          <p class="page-subtitle">إدارة بيانات الشركة وسعر الصرف والوحدات</p>
        </div>
      </div>
      <div class="tabs-container">
        <button class="tab-btn active" data-tab="company">${buildingIcon()} الشركة</button>
        <button class="tab-btn" data-tab="exchange">${dollarIcon()} سعر الصرف</button>
        <button class="tab-btn" data-tab="units">${rulerIcon()} الوحدات</button>
        <button class="tab-btn" data-tab="history">${historyIcon()} السجل</button>
      </div>
      <div id="settings-content"></div>
    </div>
  `

  async function loadTab() {
    const el = container.querySelector('#settings-content')
    showPageLoading(el, 'جاري التحميل...')

    if (activeTab === 'company')   await renderCompany(el)
    if (activeTab === 'exchange')  await renderExchange(el)
    if (activeTab === 'units')     await renderUnits(el)
    if (activeTab === 'history')   await renderHistory(el)
  }

  // ── بيانات الشركة ─────────────────────────────────────────
  async function renderCompany(el) {
    const { data: settings, error } = await getCompanySettings()
    if (error) { el.innerHTML = `<div class="alert alert-danger">${sanitize(error)}</div>`; return }

    el.innerHTML = `
      <div class="card">
        <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:1rem; display:flex; align-items:center; gap:0.375rem;">
          ${buildingIcon()} بيانات الشركة
        </p>
        <form id="company-form" novalidate style="display:flex; flex-direction:column; gap:0.875rem;">
          <div class="form-group">
            <label class="form-label" for="s-company-name">اسم الشركة <span class="required">*</span></label>
            <input id="s-company-name" name="company_name" class="form-input" type="text" maxlength="100"
              value="${sanitize(settings?.company_name ?? '')}" required />
            <p class="form-error" style="display:none;"></p>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
            <div class="form-group">
              <label class="form-label" for="s-phone">رقم الهاتف</label>
              <input id="s-phone" name="phone" class="form-input ltr" type="tel" dir="ltr" maxlength="20"
                value="${sanitize(settings?.phone ?? '')}" placeholder="+963 11 000 0000" />
              <p class="form-error" style="display:none;"></p>
            </div>
            <div class="form-group">
              <label class="form-label" for="s-fiscal">بداية السنة المالية</label>
              <input id="s-fiscal" name="fiscal_year_start" class="form-input ltr" type="date" dir="ltr"
                value="${settings?.fiscal_year_start ?? ''}" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="s-address">العنوان</label>
            <input id="s-address" name="address" class="form-input" type="text" maxlength="200"
              value="${sanitize(settings?.address ?? '')}" placeholder="المدينة، الحي، الشارع..." />
          </div>
          <div id="company-error" class="alert alert-danger" style="display:none;"></div>
          <button type="submit" id="company-submit" class="btn btn-primary btn-sm" style="align-self:flex-start;">
            ${saveIcon()} حفظ التغييرات
          </button>
        </form>
      </div>
    `

    const form = el.querySelector('#company-form')
    const user = store.getState('user')
    form?.addEventListener('submit', async (e) => {
      e.preventDefault()
      clearFormErrors(form)
      const data = {
        company_name:      form.querySelector('[name=company_name]')?.value ?? '',
        phone:             form.querySelector('[name=phone]')?.value ?? '',
        fiscal_year_start: form.querySelector('[name=fiscal_year_start]')?.value ?? '',
        address:           form.querySelector('[name=address]')?.value ?? '',
      }
      const errors = companySettingsSchema.validate(data)
      if (Object.keys(errors).length > 0) { showFormErrors(errors, form); return }

      const btn = form.querySelector('#company-submit')
      btn.classList.add('btn-loading'); btn.disabled = true

      const { data: updated, error } = await updateCompanySettings(data, user.id)
      btn.classList.remove('btn-loading'); btn.disabled = false

      if (error) {
        const errEl = form.querySelector('#company-error')
        if (errEl) { errEl.textContent = error; errEl.style.display = 'flex' }
        return
      }
      setCompanySettings(updated)
      toast.success('تم حفظ إعدادات الشركة')
    })
  }

  // ── سعر الصرف ─────────────────────────────────────────────
  async function renderExchange(el) {
    const { data: latest } = await getLatestExchangeRate()
    const user = store.getState('user')
    const todayStr = new Date().toISOString().split('T')[0]

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <!-- آخر سعر -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="card" style="background:linear-gradient(135deg,rgba(37,99,235,0.1),transparent); border-color:rgba(59,130,246,0.2);">
            <p style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">آخر سعر صرف</p>
            <p style="font-size:2rem; font-weight:800; color:#60a5fa; font-family:monospace; direction:ltr; line-height:1.2;">
              ${latest ? Number(latest.usd_to_syp).toLocaleString('ar') : '—'}
            </p>
            <p style="font-size:0.75rem; color:#475569; margin-top:4px;">ل.س / $</p>
            ${latest ? `<p style="font-size:0.7rem; color:#475569; margin-top:2px;">${formatDate(latest.rate_date)}</p>` : ''}
          </div>
          <div class="card" style="background:linear-gradient(135deg,rgba(34,197,94,0.1),transparent); border-color:rgba(34,197,94,0.2);">
            <p style="font-size:0.75rem; color:#64748b; margin-bottom:4px;">ما يعادل 100$</p>
            <p style="font-size:1.5rem; font-weight:800; color:#4ade80; font-family:monospace; direction:ltr; line-height:1.2;">
              ${latest ? (Number(latest.usd_to_syp) * 100).toLocaleString('ar') : '—'}
            </p>
            <p style="font-size:0.75rem; color:#475569; margin-top:4px;">ل.س</p>
          </div>
        </div>

        <!-- نموذج سعر جديد -->
        <div class="card">
          <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:0.875rem; display:flex; align-items:center; gap:0.375rem;">
            ${dollarIcon()} تسجيل سعر صرف جديد
          </p>
          <div class="alert alert-warning" style="margin-bottom:0.875rem; font-size:0.75rem;">
            ${warnIcon()} أسعار الصرف محمية من التعديل والحذف بعد الحفظ. كل يوم = سعر واحد.
          </div>
          <form id="exchange-form" novalidate style="display:flex; flex-direction:column; gap:0.75rem;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
              <div class="form-group">
                <label class="form-label" for="ex-date">التاريخ <span class="required">*</span></label>
                <input id="ex-date" name="rate_date" class="form-input ltr" type="date" dir="ltr" value="${todayStr}" required />
                <p class="form-error" style="display:none;"></p>
              </div>
              <div class="form-group">
                <label class="form-label" for="ex-rate">سعر الدولار (ل.س) <span class="required">*</span></label>
                <input id="ex-rate" name="usd_to_syp" class="form-input ltr" type="number" min="1" step="1" placeholder="14000" dir="ltr" required />
                <p class="form-error" style="display:none;"></p>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="ex-notes">ملاحظات</label>
              <input id="ex-notes" name="notes" class="form-input" type="text" placeholder="مثال: سعر السوق الموازي" maxlength="200" />
            </div>
            <div id="exchange-error" class="alert alert-danger" style="display:none;"></div>
            <button type="submit" id="exchange-submit" class="btn btn-primary btn-sm" style="align-self:flex-start;">
              ${saveIcon()} حفظ سعر الصرف
            </button>
          </form>
        </div>
      </div>
    `

    const form = el.querySelector('#exchange-form')
    form?.addEventListener('submit', async (e) => {
      e.preventDefault()
      clearFormErrors(form)
      const data = {
        rate_date:  form.querySelector('[name=rate_date]')?.value ?? '',
        usd_to_syp: form.querySelector('[name=usd_to_syp]')?.value ?? '',
        notes:      form.querySelector('[name=notes]')?.value ?? '',
      }
      const errors = exchangeRateSchema.validate(data)
      if (Object.keys(errors).length > 0) { showFormErrors(errors, form); return }

      const btn = form.querySelector('#exchange-submit')
      btn.classList.add('btn-loading'); btn.disabled = true

      const { data: saved, error } = await createExchangeRate({
        ...data, usd_to_syp: parseFloat(data.usd_to_syp),
      }, user.id)

      btn.classList.remove('btn-loading'); btn.disabled = false

      if (error) {
        const errEl = form.querySelector('#exchange-error')
        if (errEl) { errEl.textContent = error; errEl.style.display = 'flex' }
        return
      }
      setLatestExchangeRate(saved)
      toast.success('تم حفظ سعر الصرف')
      form.querySelector('[name=usd_to_syp]').value = ''
      form.querySelector('[name=notes]').value = ''
      await renderExchange(el)
    })
  }

  // ── الوحدات ───────────────────────────────────────────────
  async function renderUnits(el) {
    const { data: units = [] } = await getUnits(false)
    const user = store.getState('user')

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <!-- إضافة وحدة -->
        <div class="card">
          <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:0.875rem;">إضافة وحدة قياس جديدة</p>
          <form id="unit-form" novalidate style="display:flex; gap:0.625rem; flex-wrap:wrap; align-items:flex-end;">
            <div class="form-group" style="flex:1; min-width:140px; margin:0;">
              <label class="form-label" for="u-name">الاسم <span class="required">*</span></label>
              <input id="u-name" name="name" class="form-input" type="text" placeholder="كيلوغرام" maxlength="50" required />
              <p class="form-error" style="display:none;"></p>
            </div>
            <div class="form-group" style="width:90px; margin:0;">
              <label class="form-label" for="u-symbol">الرمز <span class="required">*</span></label>
              <input id="u-symbol" name="symbol" class="form-input ltr" type="text" placeholder="kg" maxlength="10" dir="ltr" required />
              <p class="form-error" style="display:none;"></p>
            </div>
            <button type="submit" id="unit-submit" class="btn btn-primary btn-sm" style="margin-bottom:1px;">
              ${plusIcon()} إضافة
            </button>
          </form>
          <div id="unit-error" class="alert alert-danger" style="display:none; margin-top:0.75rem;"></div>
        </div>

        <!-- قائمة الوحدات -->
        <div class="card">
          <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:0.875rem;">
            وحدات القياس (${units.filter(u => u.is_active).length} نشطة)
          </p>
          ${units.length === 0
            ? `<p style="color:#475569; font-size:0.875rem; text-align:center; padding:1rem 0;">لا توجد وحدات بعد</p>`
            : `<div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${units.map(u => `
                  <div style="
                    display:flex; align-items:center; gap:0.75rem;
                    padding:0.625rem 0.875rem; border-radius:10px;
                    background:rgba(30,41,59,0.4); border:1px solid rgba(51,65,85,0.4);
                    ${!u.is_active ? 'opacity:0.5;' : ''}
                  ">
                    <div style="
                      width:2.5rem; height:2rem; border-radius:8px; flex-shrink:0;
                      background:rgba(51,65,85,0.5); border:1px solid rgba(71,85,105,0.4);
                      display:flex; align-items:center; justify-content:center;
                      font-family:monospace; font-size:0.75rem; font-weight:700; color:#94a3b8;
                    ">${sanitize(u.symbol)}</div>
                    <span style="flex:1; font-size:0.875rem; font-weight:600; color:#e2e8f0;">${sanitize(u.name)}</span>
                    <span class="badge ${u.is_active ? 'badge-success' : 'badge-default'}">${u.is_active ? 'نشطة' : 'معطلة'}</span>
                    <button class="btn btn-ghost btn-sm toggle-unit-btn" data-id="${sanitize(u.id)}" data-name="${sanitize(u.name)}" data-active="${u.is_active}"
                      style="font-size:0.7rem; padding:0.25rem 0.5rem; color:${u.is_active ? '#4ade80' : '#64748b'};">
                      ${u.is_active ? toggleOnIcon() : toggleOffIcon()}
                    </button>
                  </div>
                `).join('')}
               </div>`
          }
        </div>
      </div>
    `

    // إضافة وحدة
    const form = el.querySelector('#unit-form')
    form?.addEventListener('submit', async (e) => {
      e.preventDefault()
      clearFormErrors(form)
      const data = {
        name:   form.querySelector('[name=name]')?.value ?? '',
        symbol: form.querySelector('[name=symbol]')?.value ?? '',
      }
      const errors = unitSchema.validate(data)
      if (Object.keys(errors).length > 0) { showFormErrors(errors, form); return }

      const btn = form.querySelector('#unit-submit')
      btn.classList.add('btn-loading'); btn.disabled = true

      const { error } = await createUnit(data, user.id)
      btn.classList.remove('btn-loading'); btn.disabled = false

      if (error) {
        const errEl = el.querySelector('#unit-error')
        if (errEl) { errEl.textContent = error; errEl.style.display = 'flex' }
        return
      }
      toast.success('تمت إضافة الوحدة')
      form.reset()
      await renderUnits(el)
    })

    // تبديل حالة الوحدة
    el.querySelectorAll('.toggle-unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isActive = btn.dataset.active === 'true'
        confirmToggleActive({
          itemName:  btn.dataset.name,
          isActive,
          onConfirm: async () => {
            const { error } = await toggleUnitActive(btn.dataset.id, !isActive)
            if (error) { toast.error(error); throw new Error(error) }
            toast.success(isActive ? 'تم تعطيل الوحدة' : 'تم تفعيل الوحدة')
            await renderUnits(el)
          },
        })
      })
    })
  }

  // ── سجل أسعار الصرف ───────────────────────────────────────
  async function renderHistory(el) {
    const { data: history = [], error } = await getExchangeRateHistory(30)
    if (error) { el.innerHTML = `<div class="alert alert-danger">${sanitize(error)}</div>`; return }

    el.innerHTML = `
      <div class="card">
        <p style="font-size:0.8125rem; font-weight:700; color:#94a3b8; margin-bottom:0.875rem;">
          سجل أسعار الصرف — آخر 30 يوم
          <span style="font-weight:400; color:#475569; font-size:0.75rem;">(محمي من التعديل والحذف)</span>
        </p>
        ${history.length === 0
          ? `<p style="color:#475569; text-align:center; padding:1rem 0; font-size:0.875rem;">لا توجد أسعار مسجلة</p>`
          : `<div style="display:flex; flex-direction:column; gap:0.375rem; max-height:420px; overflow-y:auto;">
              ${history.map((r, i) => {
                const prev   = history[i + 1]
                const change = prev ? r.usd_to_syp - prev.usd_to_syp : 0
                const pct    = prev && prev.usd_to_syp > 0 ? ((change / prev.usd_to_syp) * 100).toFixed(1) : null
                return `
                  <div style="
                    display:flex; align-items:center; gap:0.75rem;
                    padding:0.625rem 0.875rem; border-radius:10px;
                    background:rgba(30,41,59,0.4); border:1px solid rgba(51,65,85,0.4);
                    font-size:0.8125rem;
                  ">
                    <span style="color:#64748b; width:90px; flex-shrink:0; font-size:0.75rem;">${formatDate(r.rate_date)}</span>
                    <span style="flex:1; font-family:monospace; font-weight:700; color:#e2e8f0; direction:ltr;">
                      ${Number(r.usd_to_syp).toLocaleString('ar')} <span style="color:#475569; font-weight:400;">ل.س</span>
                    </span>
                    ${pct !== null ? `
                      <span style="font-size:0.7rem; font-weight:700; color:${change > 0 ? '#f87171' : change < 0 ? '#4ade80' : '#64748b'}; font-family:monospace; direction:ltr;">
                        ${change > 0 ? '↑' : change < 0 ? '↓' : '—'} ${change !== 0 ? Math.abs(parseFloat(pct)) + '%' : 'ثابت'}
                      </span>
                    ` : ''}
                    ${r.notes ? `<span style="font-size:0.7rem; color:#475569; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitize(r.notes)}</span>` : ''}
                  </div>
                `
              }).join('')}
             </div>`
        }
      </div>
    `
  }

  // ── ربط التبويبات ─────────────────────────────────────────
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      activeTab = btn.dataset.tab
      loadTab()
    })
  })

  await loadTab()
}

const svg = (p) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p}</svg>`
const buildingIcon = () => svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>')
const dollarIcon   = () => svg('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')
const rulerIcon    = () => svg('<line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="6" x2="19" y2="6"/><line x1="5" y1="18" x2="19" y2="18"/>')
const historyIcon  = () => svg('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>')
const saveIcon     = () => svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>')
const plusIcon     = () => svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')
const warnIcon     = () => svg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>')
const toggleOnIcon  = () => svg('<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="16" cy="12" r="3"/>')
const toggleOffIcon = () => svg('<rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3"/>')
