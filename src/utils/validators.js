/**
 * src/utils/validators.js
 * ──────────────────────────────────────────────────────────────
 * ✅ مكتبة التحقق من صحة المدخلات (Validation)
 *
 * تعمل على مستويين:
 * 1. تحقق فوري (لحظي) — عند الكتابة في الحقل
 * 2. تحقق كامل قبل الإرسال — يتحقق من كل الحقول معاً
 *
 * 🔐 ملاحظة أمنية:
 * هذا الـ Validation للـ UX فقط (رسائل مفيدة للمستخدم).
 * الحماية الحقيقية تتم في:
 *   - src/utils/security.js  (تنظيف المدخلات)
 *   - Supabase RLS Policies  (رفض العمليات غير المصرحة)
 *   - Database Constraints   (UNIQUE, CHECK, NOT NULL)
 *   - Database Triggers      (منع المخزون السالب)
 * ──────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
// 🧱 1. القواعد الأساسية (Primitive Rules)
// ══════════════════════════════════════════════════════════════

/**
 * قاموس القواعد — كل قاعدة دالة تُعيد رسالة خطأ أو null
 * @type {Record<string, (...args: any[]) => string|null>}
 */
export const rules = {

  /**
   * الحقل مطلوب
   * @param {string} label - اسم الحقل للرسالة
   */
  required: (label = 'هذا الحقل') =>
    (value) => {
      const v = value === null || value === undefined ? '' : String(value).trim()
      return v.length > 0 ? null : `${label} مطلوب`
    },

  /**
   * حد أدنى للطول
   */
  minLength: (min, label = 'النص') =>
    (value) => {
      if (!value) return null  // required يتحقق من الفراغ
      return String(value).trim().length >= min
        ? null
        : `${label} يجب أن يكون ${min} أحرف على الأقل`
    },

  /**
   * حد أقصى للطول
   */
  maxLength: (max, label = 'النص') =>
    (value) => {
      if (!value) return null
      return String(value).trim().length <= max
        ? null
        : `${label} يجب ألا يتجاوز ${max} حرفاً`
    },

  /**
   * رقم موجب (> 0)
   */
  positiveNumber: (label = 'القيمة') =>
    (value) => {
      if (value === '' || value === null || value === undefined) return null
      const n = Number(value)
      if (isNaN(n)) return `${label} يجب أن يكون رقماً`
      return n > 0 ? null : `${label} يجب أن يكون أكبر من صفر`
    },

  /**
   * رقم غير سالب (>= 0)
   */
  nonNegativeNumber: (label = 'القيمة') =>
    (value) => {
      if (value === '' || value === null || value === undefined) return null
      const n = Number(value)
      if (isNaN(n)) return `${label} يجب أن يكون رقماً`
      return n >= 0 ? null : `${label} لا يمكن أن يكون سالباً`
    },

  /**
   * نطاق رقمي
   */
  range: (min, max, label = 'القيمة') =>
    (value) => {
      if (value === '' || value === null || value === undefined) return null
      const n = Number(value)
      if (isNaN(n)) return `${label} يجب أن يكون رقماً`
      if (n < min)  return `${label} يجب أن يكون ${min} على الأقل`
      if (n > max)  return `${label} يجب ألا يتجاوز ${max}`
      return null
    },

  /**
   * بريد إلكتروني صالح
   */
  email: () =>
    (value) => {
      if (!value) return null
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
      return EMAIL_RE.test(String(value).trim())
        ? null
        : 'صيغة البريد الإلكتروني غير صحيحة'
    },

  /**
   * كلمة مرور بالحد الأدنى
   */
  password: (minLen = 6) =>
    (value) => {
      if (!value) return null
      return String(value).length >= minLen
        ? null
        : `كلمة المرور يجب أن تكون ${minLen} أحرف على الأقل`
    },

  /**
   * تاريخ صالح بصيغة YYYY-MM-DD
   */
  date: (label = 'التاريخ') =>
    (value) => {
      if (!value) return null
      const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
      if (!DATE_RE.test(String(value))) return `${label} غير صحيح`
      const d = new Date(value)
      return isNaN(d.getTime()) ? `${label} غير صحيح` : null
    },

  /**
   * تاريخ غير مستقبلي
   */
  notFutureDate: (label = 'التاريخ') =>
    (value) => {
      if (!value) return null
      const d = new Date(value)
      if (isNaN(d.getTime())) return `${label} غير صحيح`
      return d <= new Date() ? null : `${label} لا يمكن أن يكون في المستقبل`
    },

  /**
   * نص لا يحتوي على أحرف خاصة خطيرة
   * (XSS prevention hint للمستخدم)
   */
  safeText: (label = 'النص') =>
    (value) => {
      if (!value) return null
      const DANGEROUS = /<script|javascript:|on\w+=/i
      return DANGEROUS.test(String(value))
        ? `${label} يحتوي على أحرف غير مسموح بها`
        : null
    },

  /**
   * رمز/كود — أحرف وأرقام وشرطات فقط
   */
  code: (label = 'الرمز') =>
    (value) => {
      if (!value) return null
      const CODE_RE = /^[\w\-\s]+$/
      return CODE_RE.test(String(value).trim())
        ? null
        : `${label} يجب أن يحتوي على أحرف وأرقام وشرطات فقط`
    },

  /**
   * UUID صالح
   */
  uuid: (label = 'المعرّف') =>
    (value) => {
      if (!value) return null
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return UUID_RE.test(String(value)) ? null : `${label} غير صالح`
    },

  /**
   * رقم هاتف — أرقام ومسافات و+()- فقط
   */
  phone: () =>
    (value) => {
      if (!value) return null
      const PHONE_RE = /^[\d\s+\-()\u0660-\u0669]{7,20}$/
      return PHONE_RE.test(String(value).trim())
        ? null
        : 'رقم الهاتف غير صحيح'
    },

  /**
   * كمية محاسبية — موجبة ولا تتجاوز 3 خانات عشرية
   */
  accountingQty: (label = 'الكمية') =>
    (value) => {
      if (value === '' || value === null || value === undefined) return null
      const n = Number(value)
      if (isNaN(n) || n <= 0) return `${label} يجب أن تكون أكبر من صفر`
      if (n > 999_999_999)    return `${label} كبيرة جداً`
      const str = String(value)
      if (str.includes('.') && str.split('.')[1].length > 3) {
        return `${label} لا تقبل أكثر من 3 خانات عشرية`
      }
      return null
    },

  /**
   * سعر — موجب ولا يتجاوز 2 خانات عشرية للدولار
   */
  price: (label = 'السعر') =>
    (value) => {
      if (value === '' || value === null || value === undefined) return null
      const n = Number(value)
      if (isNaN(n))  return `${label} يجب أن يكون رقماً`
      if (n < 0)     return `${label} لا يمكن أن يكون سالباً`
      if (n > 1e12)  return `${label} كبير جداً`
      return null
    },

  /**
   * سعر صرف — موجب ومنطقي
   */
  exchangeRate: () =>
    (value) => {
      if (value === '' || value === null || value === undefined) return null
      const n = Number(value)
      if (isNaN(n) || n <= 0)        return 'سعر الصرف يجب أن يكون أكبر من صفر'
      if (n < 1)                     return 'سعر الصرف غير منطقي (أقل من 1)'
      if (n > 10_000_000)            return 'سعر الصرف كبير جداً'
      return null
    },
}

// ══════════════════════════════════════════════════════════════
// 🏗️ 2. Schema Validator — التحقق من نماذج كاملة
// ══════════════════════════════════════════════════════════════

/**
 * إنشاء validator لنموذج كامل
 *
 * @param {Record<string, Function[]>} schema - تعريف القواعد لكل حقل
 * @returns {{ validate, validateField, getErrors, isValid }}
 *
 * @example
 *   const v = createValidator({
 *     name:  [rules.required('الاسم'), rules.minLength(2, 'الاسم')],
 *     email: [rules.required('البريد'), rules.email()],
 *   })
 *
 *   const errors = v.validate({ name: '', email: 'bad' })
 *   // { name: 'الاسم مطلوب', email: 'صيغة البريد غير صحيحة' }
 */
export function createValidator(schema) {

  /**
   * التحقق من كل الحقول
   * @param {object} data
   * @returns {Record<string, string>} كائن الأخطاء (فارغ = لا أخطاء)
   */
  function validate(data) {
    const errors = {}

    for (const [field, fieldRules] of Object.entries(schema)) {
      if (!Array.isArray(fieldRules)) continue

      const value = data?.[field]

      for (const rule of fieldRules) {
        if (typeof rule !== 'function') continue
        const error = rule(value)
        if (error) {
          errors[field] = error
          break  // أول خطأ يكفي لكل حقل
        }
      }
    }

    return errors
  }

  /**
   * التحقق من حقل واحد فقط
   * @param {string} field
   * @param {any} value
   * @returns {string|null}
   */
  function validateField(field, value) {
    const fieldRules = schema[field]
    if (!Array.isArray(fieldRules)) return null

    for (const rule of fieldRules) {
      if (typeof rule !== 'function') continue
      const error = rule(value)
      if (error) return error
    }

    return null
  }

  /**
   * هل النموذج صالح؟
   * @param {object} data
   * @returns {boolean}
   */
  function isValid(data) {
    return Object.keys(validate(data)).length === 0
  }

  return { validate, validateField, isValid }
}

// ══════════════════════════════════════════════════════════════
// 📋 3. Schemas جاهزة للنماذج الرئيسية
// ══════════════════════════════════════════════════════════════

/** Schema نموذج تسجيل الدخول */
export const loginSchema = createValidator({
  email:    [rules.required('البريد الإلكتروني'), rules.email()],
  password: [rules.required('كلمة المرور'), rules.password(6)],
})

/** Schema نموذج إضافة/تعديل مادة */
export const materialSchema = createValidator({
  name:            [rules.required('اسم المادة'), rules.minLength(2, 'اسم المادة'), rules.maxLength(150, 'اسم المادة'), rules.safeText('اسم المادة')],
  unit_id:         [rules.required('وحدة القياس'), rules.uuid('وحدة القياس')],
  code:            [rules.maxLength(50, 'الرمز'), rules.code('الرمز')],
  description:     [rules.maxLength(500, 'الوصف')],
  min_stock_alert: [rules.nonNegativeNumber('حد التنبيه')],
  unit_cost_syp:   [rules.price('سعر الوحدة (ل.س)')],
  unit_cost_usd:   [rules.price('سعر الوحدة ($)')],
})

/** Schema نموذج الحركة المحاسبية */
export const transactionSchema = createValidator({
  material_id:      [rules.required('المادة'), rules.uuid('المادة')],
  transaction_type: [rules.required('نوع الحركة')],
  quantity:         [rules.required('الكمية'), rules.accountingQty('الكمية')],
  unit_cost_syp:    [rules.price('سعر الوحدة (ل.س)')],
  unit_cost_usd:    [rules.price('سعر الوحدة ($)')],
  reference_number: [rules.maxLength(50, 'الرقم المرجعي')],
  notes:            [rules.maxLength(500, 'الملاحظات')],
})

/** Schema نموذج سعر الصرف */
export const exchangeRateSchema = createValidator({
  rate_date:  [rules.required('التاريخ'), rules.date('التاريخ')],
  usd_to_syp: [rules.required('سعر الصرف'), rules.exchangeRate()],
  notes:      [rules.maxLength(200, 'الملاحظات')],
})

/** Schema نموذج إعدادات الشركة */
export const companySettingsSchema = createValidator({
  company_name: [rules.required('اسم الشركة'), rules.minLength(2, 'اسم الشركة'), rules.maxLength(100, 'اسم الشركة')],
  phone:        [rules.phone(), rules.maxLength(20, 'رقم الهاتف')],
  address:      [rules.maxLength(200, 'العنوان')],
})

/** Schema نموذج إضافة وحدة قياس */
export const unitSchema = createValidator({
  name:   [rules.required('اسم الوحدة'), rules.minLength(2, 'اسم الوحدة'), rules.maxLength(50, 'اسم الوحدة')],
  symbol: [rules.required('رمز الوحدة'), rules.maxLength(10, 'رمز الوحدة')],
})

/** Schema نموذج الأرشفة */
export const archiveSchema = createValidator({
  reason: [rules.required('سبب الأرشفة'), rules.minLength(5, 'سبب الأرشفة'), rules.maxLength(500, 'سبب الأرشفة')],
})

// ══════════════════════════════════════════════════════════════
// 🎨 4. ربط الـ Validation بالـ DOM (Live Validation)
// ══════════════════════════════════════════════════════════════

/**
 * تفعيل التحقق الفوري على حقل HTML
 *
 * يُضيف event listener على blur وinput،
 * ويعرض رسائل الخطأ تحت الحقل تلقائياً.
 *
 * @param {HTMLElement} inputEl    - عنصر الإدخال
 * @param {Function[]}  fieldRules - مصفوفة القواعد
 * @param {object}      [options]
 * @param {boolean}     [options.validateOnInput=false] - التحقق أثناء الكتابة
 * @returns {{ destroy: Function }} - دالة لإزالة الـ listeners
 */
export function bindFieldValidation(inputEl, fieldRules, { validateOnInput = false } = {}) {
  if (!inputEl || !Array.isArray(fieldRules)) return { destroy: () => {} }

  // العثور على عنصر رسالة الخطأ (أو إنشاؤه)
  let errorEl = inputEl.parentElement?.querySelector('.form-error')
  if (!errorEl) {
    errorEl = document.createElement('p')
    errorEl.className = 'form-error'
    errorEl.setAttribute('role', 'alert')
    errorEl.setAttribute('aria-live', 'polite')
    inputEl.parentElement?.appendChild(errorEl)
  }

  function validate() {
    const value = inputEl.value
    let errorMsg = null

    for (const rule of fieldRules) {
      if (typeof rule !== 'function') continue
      const err = rule(value)
      if (err) { errorMsg = err; break }
    }

    if (errorMsg) {
      errorEl.textContent = `⚠ ${errorMsg}`
      errorEl.style.display = 'flex'
      inputEl.classList.add('has-error')
      inputEl.setAttribute('aria-invalid', 'true')
    } else {
      errorEl.textContent = ''
      errorEl.style.display = 'none'
      inputEl.classList.remove('has-error')
      inputEl.removeAttribute('aria-invalid')
    }

    return !errorMsg
  }

  function onBlur()  { validate() }
  function onInput() { if (inputEl.classList.contains('has-error')) validate() }
  function onInputLive() { validate() }

  inputEl.addEventListener('blur', onBlur)
  inputEl.addEventListener('input', validateOnInput ? onInputLive : onInput)

  return {
    validate,
    destroy() {
      inputEl.removeEventListener('blur', onBlur)
      inputEl.removeEventListener('input', validateOnInput ? onInputLive : onInput)
    },
  }
}

/**
 * عرض أخطاء Validation على نموذج HTML كامل
 *
 * @param {Record<string, string>} errors  - كائن الأخطاء من validate()
 * @param {HTMLElement}            formEl  - عنصر الـ form
 */
export function showFormErrors(errors, formEl) {
  if (!formEl) return

  // أولاً: مسح كل الأخطاء السابقة
  clearFormErrors(formEl)

  // ثانياً: عرض الأخطاء الجديدة
  for (const [field, message] of Object.entries(errors)) {
    const inputEl = formEl.querySelector(`[name="${field}"], [data-field="${field}"]`)
    if (!inputEl) continue

    inputEl.classList.add('has-error')
    inputEl.setAttribute('aria-invalid', 'true')

    // البحث عن عنصر الخطأ الموجود أو إنشاء جديد
    let errorEl = inputEl.closest('.form-group')?.querySelector('.form-error')
                  ?? inputEl.parentElement?.querySelector('.form-error')

    if (!errorEl) {
      errorEl = document.createElement('p')
      errorEl.className = 'form-error'
      errorEl.setAttribute('role', 'alert')
      inputEl.parentElement?.appendChild(errorEl)
    }

    errorEl.textContent = `⚠ ${message}`
    errorEl.style.display = 'flex'
  }

  // التركيز على أول حقل خطأ
  const firstErrorField = Object.keys(errors)[0]
  if (firstErrorField) {
    const el = formEl.querySelector(`[name="${firstErrorField}"]`)
    el?.focus()
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

/**
 * مسح كل رسائل الخطأ من نموذج
 * @param {HTMLElement} formEl
 */
export function clearFormErrors(formEl) {
  if (!formEl) return

  formEl.querySelectorAll('.has-error').forEach(el => {
    el.classList.remove('has-error')
    el.removeAttribute('aria-invalid')
  })

  formEl.querySelectorAll('.form-error').forEach(el => {
    el.textContent = ''
    el.style.display = 'none'
  })
}

/**
 * مسح خطأ حقل واحد
 * @param {HTMLElement} inputEl
 */
export function clearFieldError(inputEl) {
  if (!inputEl) return
  inputEl.classList.remove('has-error')
  inputEl.removeAttribute('aria-invalid')
  const errorEl = inputEl.parentElement?.querySelector('.form-error')
  if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none' }
}
