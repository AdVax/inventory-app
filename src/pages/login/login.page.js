/**
 * src/pages/login/login.page.js
 * ──────────────────────────────────────────────────────────────
 * 🔐 صفحة تسجيل الدخول
 * ──────────────────────────────────────────────────────────────
 */

import { signIn }               from '../../services/auth.service.js'
import { setUser }              from '../../store/store.js'
import { loginSchema, showFormErrors, clearFormErrors } from '../../utils/validators.js'
import { sanitize }             from '../../utils/security.js'
import { toast }                from '../../components/toast.js'

// ══════════════════════════════════════════════════════════════
export async function renderLoginPage(container) {
  if (!container) return

  container.innerHTML = `
    <div class="login-page">
      <div class="login-bg-blob-1"></div>
      <div class="login-bg-blob-2"></div>
      <div class="login-bg-grid"></div>

      <div class="login-card">
        <div class="login-card-bar"></div>
        <div class="login-card-body">

          <!-- الهيدر -->
          <div style="text-align:center; margin-bottom:2rem;">
            <div style="
              display:inline-flex; align-items:center; justify-content:center;
              width:3.5rem; height:3.5rem; border-radius:16px; margin-bottom:1rem;
              background:linear-gradient(135deg,#2563eb,#0ea5e9);
              box-shadow:0 8px 24px rgba(37,99,235,0.35);
            ">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h1 style="font-size:1.375rem; font-weight:800; color:#f1f5f9; margin-bottom:0.25rem;">
              تسجيل الدخول
            </h1>
            <p style="color:#64748b; font-size:0.8125rem;">نظام إدارة المخزون والمحاسبة</p>
          </div>

          <!-- رسالة خطأ عامة -->
          <div id="login-general-error" style="display:none;" class="alert alert-danger" style="margin-bottom:1.25rem;" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px;">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span id="login-error-text"></span>
          </div>

          <!-- النموذج -->
          <form id="login-form" novalidate style="display:flex; flex-direction:column; gap:1.25rem;">

            <!-- البريد الإلكتروني -->
            <div class="form-group">
              <label class="form-label" for="login-email">البريد الإلكتروني</label>
              <div class="input-wrapper">
                <span class="input-icon-right">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </span>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  class="form-input has-icon-right ltr"
                  placeholder="example@domain.com"
                  autocomplete="email"
                  inputmode="email"
                  dir="ltr"
                  required
                />
              </div>
              <p class="form-error" id="email-error" style="display:none;"></p>
            </div>

            <!-- كلمة المرور -->
            <div class="form-group">
              <label class="form-label" for="login-password">كلمة المرور</label>
              <div class="input-wrapper">
                <span class="input-icon-right">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  class="form-input has-icon-right has-icon-left"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  dir="ltr"
                  required
                />
                <button
                  type="button"
                  id="toggle-password"
                  class="input-icon-left"
                  style="background:none;border:none;cursor:pointer;color:#64748b;padding:0;"
                  aria-label="إظهار/إخفاء كلمة المرور"
                >
                  <svg id="eye-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              <p class="form-error" id="password-error" style="display:none;"></p>
            </div>

            <!-- زر الدخول -->
            <button
              id="login-submit-btn"
              type="submit"
              class="btn btn-primary btn-full btn-lg"
              style="margin-top:0.5rem;"
            >
              دخول
            </button>
          </form>

          <!-- الفاصل السفلي -->
          <div style="
            margin-top:2rem; padding-top:1.25rem;
            border-top:1px solid rgba(51,65,85,0.5);
            text-align:center;
          ">
            <p style="color:#475569; font-size:0.75rem;">
              نظام محاسبي مغلق · للمستخدمين المصرح لهم فقط
            </p>
          </div>

        </div>
      </div>
    </div>
  `

  // ── ربط الأحداث ────────────────────────────────────────────
  const form        = container.querySelector('#login-form')
  const emailInput  = container.querySelector('#login-email')
  const passInput   = container.querySelector('#login-password')
  const submitBtn   = container.querySelector('#login-submit-btn')
  const toggleBtn   = container.querySelector('#toggle-password')
  const errorBanner = container.querySelector('#login-general-error')
  const errorText   = container.querySelector('#login-error-text')

  // إظهار/إخفاء كلمة المرور
  toggleBtn?.addEventListener('click', () => {
    const isText = passInput.type === 'text'
    passInput.type = isText ? 'password' : 'text'
    toggleBtn.querySelector('#eye-icon').innerHTML = isText
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
  })

  // إخفاء رسالة الخطأ عند الكتابة
  function hideError() {
    if (errorBanner) errorBanner.style.display = 'none'
  }
  emailInput?.addEventListener('input', hideError)
  passInput?.addEventListener('input',  hideError)

  // إرسال النموذج
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()

    const email    = emailInput?.value ?? ''
    const password = passInput?.value  ?? ''

    // التحقق من المدخلات
    const errors = loginSchema.validate({ email, password })

    // مسح الأخطاء القديمة وعرض الجديدة
    clearFormErrors(form)
    if (Object.keys(errors).length > 0) {
      showFormErrors(errors, form)
      return
    }

    // حالة التحميل
    submitBtn.classList.add('btn-loading')
    submitBtn.disabled = true
    if (errorBanner) errorBanner.style.display = 'none'

    const { data: profile, error } = await signIn(email, password)

    submitBtn.classList.remove('btn-loading')
    submitBtn.disabled = false

    if (error) {
      // عرض رسالة الخطأ
      if (errorText)   errorText.textContent = error
      if (errorBanner) errorBanner.style.display = 'flex'
      // اهتزاز طفيف للبطاقة
      const card = container.querySelector('.login-card-body')
      if (card) {
        card.style.animation = 'none'
        card.style.transform = 'translateX(6px)'
        setTimeout(() => { card.style.transform = 'translateX(-6px)' }, 60)
        setTimeout(() => { card.style.transform = 'translateX(0)'; card.style.transition = 'transform 0.15s' }, 120)
      }
      passInput?.focus()
      return
    }

    // نجح الدخول
    toast.success(`أهلاً ${sanitize(profile.full_name?.split(' ')[0] ?? '')} 👋`)
    setUser(profile)
    // الـ router يُوجّه تلقائياً عبر store:user listener
  })

  // التركيز على حقل البريد
  emailInput?.focus()
}
