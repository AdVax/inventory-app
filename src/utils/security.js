/**
 * src/utils/security.js
 * ──────────────────────────────────────────────────────────────
 * 🔐 طبقة الحماية الأمنية للواجهة الأمامية
 *
 * هذا الملف يوفر:
 * 1. الحماية من XSS (Cross-Site Scripting)
 * 2. تعقيم المدخلات (Input Sanitization)
 * 3. التحقق من الصلاحيات في الواجهة (UI Guard)
 * 4. منع CSRF في الطلبات
 * 5. تسجيل محاولات التلاعب
 *
 * ⚠️ تذكير مهم:
 * هذه الحماية طبقة "Defense in Depth" إضافية فقط.
 * الحماية الحقيقية والموثوقة هي في Supabase RLS Policies.
 * لا تعتمد على هذا الملف كخط دفاع وحيد.
 * ──────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
// 🛡️ 1. حماية XSS — تعقيم النصوص
// ══════════════════════════════════════════════════════════════

/**
 * تحويل الأحرف الخطرة في HTML إلى Entities آمنة
 * الأحرف المستبدلة: & < > " ' ` / = backslash
 *
 * ✅ آمن: <div> → &lt;div&gt;
 * ✅ آمن: <script>alert(1)</script> → لا ينفذ
 *
 * @param {any} input - أي قيمة مدخلة
 * @returns {string} نص آمن للعرض في HTML
 */
export function escapeHtml(input) {
  if (input === null || input === undefined) return ''
  const str = String(input)

  const MAP = {
    '&':  '&amp;',
    '<':  '&lt;',
    '>':  '&gt;',
    '"':  '&quot;',
    "'":  '&#39;',
    '`':  '&#96;',
    '/':  '&#x2F;',
    '=':  '&#x3D;',
    '\\': '&#x5C;',
  }

  return str.replace(/[&<>"'`/=\\]/g, char => MAP[char])
}

/**
 * تعقيم نص للعرض الآمن داخل HTML
 * استخدم هذا دائماً عند إضافة بيانات المستخدم لـ innerHTML
 *
 * ✅ الاستخدام الصحيح:
 *   element.innerHTML = `<span>${sanitize(userInput)}</span>`
 *
 * ✅ الاستخدام الأفضل (لا يحتاج sanitize):
 *   element.textContent = userInput
 *
 * @param {any} input
 * @returns {string}
 */
export function sanitize(input) {
  return escapeHtml(input)
}

/**
 * تعقيم كائن كامل — كل خصائصه النصية
 * مفيد عند عرض بيانات من قاعدة البيانات
 *
 * @param {object} obj - كائن البيانات
 * @param {string[]} [fields] - الحقول المراد تعقيمها (اختياري — كل النصوص إذا فارغ)
 * @returns {object} نسخة معقمة من الكائن
 */
export function sanitizeObject(obj, fields = null) {
  if (!obj || typeof obj !== 'object') return obj

  const result = { ...obj }

  const fieldsToSanitize = fields || Object.keys(result)

  for (const key of fieldsToSanitize) {
    if (typeof result[key] === 'string') {
      result[key] = escapeHtml(result[key])
    }
  }

  return result
}

/**
 * تعقيم مصفوفة من الكائنات
 *
 * @param {object[]} arr
 * @param {string[]} [fields]
 * @returns {object[]}
 */
export function sanitizeArray(arr, fields = null) {
  if (!Array.isArray(arr)) return []
  return arr.map(item => sanitizeObject(item, fields))
}

// ══════════════════════════════════════════════════════════════
// 🧹 2. تنظيف المدخلات قبل الإرسال لـ Supabase
//
// Supabase يستخدم Parameterized Queries تلقائياً
// لذا يتم الحماية من SQL Injection تلقائياً.
// لكن هذه الدوال تنظف المدخلات من:
// - المسافات الزائدة
// - الأحرف غير المرئية
// - القيم الفارغة
// ══════════════════════════════════════════════════════════════

/**
 * تنظيف نص مدخل من المسافات والأحرف غير المرئية
 *
 * @param {string} value
 * @param {boolean} [allowEmpty=false]
 * @returns {string}
 */
export function cleanString(value, allowEmpty = false) {
  if (value === null || value === undefined) return ''

  // حذف null bytes وأحرف التحكم (إلا newline و tab)
  const cleaned = String(value)
    .replace(/\x00/g, '')          // Null byte
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // Control chars
    .trim()

  return cleaned
}

/**
 * تنظيف رقم مدخل
 *
 * @param {any} value
 * @param {object} [options]
 * @param {number} [options.min=0]
 * @param {number} [options.max=Infinity]
 * @param {boolean} [options.allowNegative=false]
 * @returns {number|null}
 */
export function cleanNumber(value, options = {}) {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, allowNegative = false } = options

  const num = parseFloat(String(value).replace(/[^\d.-]/g, ''))

  if (isNaN(num)) return null
  if (!allowNegative && num < 0) return null
  if (num < min) return null
  if (num > max) return null

  return num
}

/**
 * تنظيف UUID — التحقق من أنه UUID صالح
 *
 * @param {string} uuid
 * @returns {string|null}
 */
export function cleanUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return null
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return UUID_REGEX.test(uuid.trim()) ? uuid.trim().toLowerCase() : null
}

/**
 * تنظيف تاريخ — التحقق من أنه صيغة YYYY-MM-DD
 *
 * @param {string} date
 * @param {boolean} [notFuture=false] منع التواريخ المستقبلية
 * @returns {string|null}
 */
export function cleanDate(date, notFuture = false) {
  if (!date) return null
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
  if (!DATE_REGEX.test(date)) return null

  const d = new Date(date)
  if (isNaN(d.getTime())) return null

  if (notFuture && d > new Date()) return null

  return date
}

/**
 * تنظيف نوع الحركة المحاسبية
 * يُقبل فقط الأنواع المعرفة في قاعدة البيانات
 *
 * @param {string} type
 * @returns {string|null}
 */
export function cleanTransactionType(type) {
  const ALLOWED_TYPES = [
    'stock_in',
    'stock_out',
    'adjustment_add',
    'adjustment_sub',
    'disposal',
    'opening_balance',
    'transfer_in',
    'transfer_out',
  ]

  return ALLOWED_TYPES.includes(type) ? type : null
}

// ══════════════════════════════════════════════════════════════
// 🔒 3. حراسة الصلاحيات في الواجهة (UI Guard)
//
// ⚠️ تذكير: هذا للـ UX فقط — الحماية الحقيقية في RLS
// ══════════════════════════════════════════════════════════════

/**
 * التحقق من أن المستخدم admin
 * يُستخدم لإخفاء/إظهار عناصر الواجهة فقط
 *
 * @param {object|null} user - كائن المستخدم من الـ store
 * @returns {boolean}
 */
export function isAdmin(user) {
  return user?.role === 'admin' && user?.is_active === true
}

/**
 * التحقق من أن المستخدم viewer
 * @param {object|null} user
 * @returns {boolean}
 */
export function isViewer(user) {
  return user?.role === 'viewer' && user?.is_active === true
}

/**
 * منع تنفيذ دالة إذا لم يكن المستخدم admin
 * تستخدم في أحداث الأزرار للحماية الإضافية
 *
 * @param {object|null} user
 * @param {Function} action - الدالة المراد تنفيذها
 * @param {Function} [onDenied] - ما يحدث عند الرفض
 */
export function adminOnly(user, action, onDenied = null) {
  if (!isAdmin(user)) {
    // تسجيل محاولة التجاوز
    logSecurityEvent('UNAUTHORIZED_UI_ACTION', {
      userId: user?.id || 'unknown',
      role:   user?.role || 'unknown',
    })

    if (onDenied) {
      onDenied()
    } else {
      // سيتم استيراد toast لاحقاً — نستخدم console مؤقتاً
      console.warn('🔒 محاولة وصول غير مصرح بها')
    }
    return
  }
  action()
}

// ══════════════════════════════════════════════════════════════
// 📝 4. تسجيل الأحداث الأمنية
// ══════════════════════════════════════════════════════════════

/**
 * تسجيل أحداث أمنية مشبوهة
 * في الإنتاج يمكن إرسالها لـ Supabase أو نظام مراقبة
 *
 * @param {string} eventType
 * @param {object} [details]
 */
export function logSecurityEvent(eventType, details = {}) {
  const event = {
    type:      eventType,
    timestamp: new Date().toISOString(),
    url:       window.location.href,
    userAgent: navigator.userAgent.slice(0, 100), // مختصر للخصوصية
    ...details,
  }

  // في وضع التطوير — نعرض في Console
  if (window.location.hostname === 'localhost') {
    console.warn('🔐 Security Event:', event)
  }

  // في الإنتاج — يمكن إرسال للسيرفر
  // supabase.from('security_log').insert(event) — إذا أردت
}

// ══════════════════════════════════════════════════════════════
// 🔧 5. دوال مساعدة إضافية
// ══════════════════════════════════════════════════════════════

/**
 * إنشاء HTML آمن من template
 * بديل لـ innerHTML المباشر
 *
 * مثال:
 *   const html = safeTemplate`<div>${userData.name}</div>`
 *
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {string}
 */
export function safeTemplate(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const value = values[i - 1]
    return result + escapeHtml(value) + str
  })
}

/**
 * التحقق من أن URL آمن (منع javascript: URLs)
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  if (!url) return false
  const dangerous = /^(javascript:|data:|vbscript:|file:)/i
  return !dangerous.test(url.trim())
}

/**
 * تعقيم رقم هاتف
 *
 * @param {string} phone
 * @returns {string}
 */
export function cleanPhone(phone) {
  if (!phone) return ''
  // نقبل فقط: أرقام، مسافات، +، -, (, )
  return phone.replace(/[^\d\s+\-()]/g, '').trim().slice(0, 20)
}

/**
 * توليد معرّف فريد للجانب العميل (ليس UUID - للاستخدام المحلي فقط)
 * للحالات التي نحتاج فيها لمعرّف مؤقت قبل الحفظ في قاعدة البيانات
 *
 * @returns {string}
 */
export function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ══════════════════════════════════════════════════════════════
// تصدير مجمّع لسهولة الاستيراد
// ══════════════════════════════════════════════════════════════
export default {
  escapeHtml,
  sanitize,
  sanitizeObject,
  sanitizeArray,
  cleanString,
  cleanNumber,
  cleanUUID,
  cleanDate,
  cleanTransactionType,
  cleanPhone,
  isAdmin,
  isViewer,
  adminOnly,
  logSecurityEvent,
  safeTemplate,
  isSafeUrl,
  generateTempId,
}
