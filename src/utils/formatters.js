/**
 * src/utils/formatters.js
 * ──────────────────────────────────────────────────────────────
 * 🎨 دوال تنسيق العرض
 *
 * تغطي:
 * 1. تنسيق العملات (ل.س / $) بدقة محاسبية
 * 2. تنسيق التواريخ بالعربية
 * 3. تنسيق الأرقام والكميات
 * 4. تنسيق الوقت النسبي ("منذ X دقيقة")
 * 5. تنسيق أنواع الحركات
 *
 * 🔐 ملاحظة أمنية:
 * جميع الدوال هنا للعرض فقط (Presentation Layer).
 * لا تستخدمها لحسابات مالية — استخدم الأرقام الخام.
 * Intl.NumberFormat آمنة من XSS لأنها تُنتج نصاً فقط.
 * ──────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
// 💰 1. تنسيق العملات
// ══════════════════════════════════════════════════════════════

/**
 * تنسيق مبلغ بالليرة السورية
 *
 * @param {number} amount
 * @param {object} [options]
 * @param {boolean} [options.showSymbol=true]
 * @param {boolean} [options.compact=false]  - اختصار للأرقام الكبيرة
 * @returns {string}
 *
 * @example
 *   formatSYP(14250000) → "14,250,000 ل.س"
 *   formatSYP(14250000, {compact:true}) → "14.25 م ل.س"
 */
export function formatSYP(amount, { showSymbol = true, compact = false } = {}) {
  const num = Number(amount)
  if (isNaN(num)) return showSymbol ? '— ل.س' : '—'

  let formatted

  if (compact && Math.abs(num) >= 1_000_000) {
    formatted = new Intl.NumberFormat('ar-SY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num / 1_000_000) + ' م'
  } else {
    formatted = new Intl.NumberFormat('ar-SY', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  return showSymbol ? `${formatted} ل.س` : formatted
}

/**
 * تنسيق مبلغ بالدولار الأمريكي
 *
 * @param {number} amount
 * @param {object} [options]
 * @param {boolean} [options.showSymbol=true]
 * @returns {string}
 *
 * @example
 *   formatUSD(1250.5) → "$ 1,250.50"
 */
export function formatUSD(amount, { showSymbol = true } = {}) {
  const num = Number(amount)
  if (isNaN(num)) return showSymbol ? '$ —' : '—'

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)

  return showSymbol ? `$ ${formatted}` : formatted
}

/**
 * تنسيق مبلغ بعملة محددة
 *
 * @param {number} amount
 * @param {'SYP'|'USD'} currency
 * @param {object} [options]
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'SYP', options = {}) {
  return currency === 'USD'
    ? formatUSD(amount, options)
    : formatSYP(amount, options)
}

/**
 * تحويل دولار → ليرة
 * @param {number} usd
 * @param {number} rate - سعر الصرف (ليرة لكل دولار)
 * @returns {number}
 */
export function usdToSyp(usd, rate) {
  const u = Number(usd)
  const r = Number(rate)
  if (isNaN(u) || isNaN(r) || r <= 0) return 0
  return Math.round(u * r)
}

/**
 * تحويل ليرة → دولار
 * @param {number} syp
 * @param {number} rate
 * @returns {number}
 */
export function sypToUsd(syp, rate) {
  const s = Number(syp)
  const r = Number(rate)
  if (isNaN(s) || isNaN(r) || r <= 0) return 0
  return s / r
}

// ══════════════════════════════════════════════════════════════
// 📅 2. تنسيق التواريخ والأوقات
// ══════════════════════════════════════════════════════════════

/**
 * تنسيق تاريخ بالعربية
 *
 * @param {string|Date} dateInput - ISO string أو Date object
 * @param {object} [options]
 * @param {boolean} [options.withTime=false]  - إضافة الوقت
 * @param {boolean} [options.shortMonth=true] - شهر مختصر
 * @returns {string}
 *
 * @example
 *   formatDate('2024-03-15')              → "15 مار 2024"
 *   formatDate('2024-03-15', {withTime:true}) → "15 مار 2024، 14:30"
 */
export function formatDate(dateInput, { withTime = false, shortMonth = true } = {}) {
  if (!dateInput) return '—'

  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
    if (isNaN(date.getTime())) return '—'

    const opts = {
      year:  'numeric',
      month: shortMonth ? 'short' : 'long',
      day:   'numeric',
      ...(withTime ? {
        hour:   '2-digit',
        minute: '2-digit',
      } : {}),
    }

    return date.toLocaleDateString('ar-SY', opts)
  } catch {
    return '—'
  }
}

/**
 * تنسيق تاريخ فقط بدون وقت (للعرض في الجداول)
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatDateShort(dateInput) {
  return formatDate(dateInput, { shortMonth: true })
}

/**
 * تنسيق وقت نسبي ("منذ X دقيقة")
 *
 * @param {string|Date} dateInput
 * @returns {string}
 *
 * @example
 *   timeAgo('2024-03-15T10:00:00Z') → "منذ 5 دقائق"
 */
export function timeAgo(dateInput) {
  if (!dateInput) return '—'

  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
    if (isNaN(date.getTime())) return '—'

    const diffMs    = Date.now() - date.getTime()
    const diffSecs  = Math.floor(diffMs / 1000)
    const diffMins  = Math.floor(diffMs / 60_000)
    const diffHours = Math.floor(diffMs / 3_600_000)
    const diffDays  = Math.floor(diffMs / 86_400_000)

    if (diffSecs  <  60)  return 'الآن'
    if (diffMins  <  60)  return `منذ ${arabicNum(diffMins)} دقيقة`
    if (diffHours <  24)  return `منذ ${arabicNum(diffHours)} ساعة`
    if (diffDays  <   7)  return `منذ ${arabicNum(diffDays)} يوم`
    if (diffDays  <  30)  return `منذ ${arabicNum(Math.floor(diffDays / 7))} أسبوع`
    if (diffDays  < 365)  return `منذ ${arabicNum(Math.floor(diffDays / 30))} شهر`

    return formatDate(date)
  } catch {
    return '—'
  }
}

/**
 * تنسيق تاريخ لقيمة حقل input[type="date"]
 * @param {string|Date} dateInput
 * @returns {string} YYYY-MM-DD
 */
export function toInputDate(dateInput) {
  if (!dateInput) return ''
  try {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
    if (isNaN(date.getTime())) return ''
    return date.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

/**
 * الحصول على تاريخ اليوم بتنسيق YYYY-MM-DD
 * @returns {string}
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

/**
 * الحصول على تاريخ قبل X يوم بتنسيق YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
export function daysAgoISO(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// ══════════════════════════════════════════════════════════════
// 🔢 3. تنسيق الأرقام والكميات
// ══════════════════════════════════════════════════════════════

/**
 * تنسيق رقم بالأرقام العربية (أو اللاتينية حسب التفضيل)
 * نستخدم اللاتينية للأرقام لأنها أوضح في المحاسبة
 *
 * @param {number} num
 * @param {number} [decimals=0]
 * @returns {string}
 */
export function formatNumber(num, decimals = 0) {
  const n = Number(num)
  if (isNaN(n)) return '—'

  return new Intl.NumberFormat('ar-SY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

/**
 * تنسيق كمية مادة مع رمز الوحدة
 *
 * @param {number} quantity
 * @param {string} [unitSymbol='']
 * @param {number} [maxDecimals=3]
 * @returns {string}
 *
 * @example
 *   formatQuantity(150.5, 'kg') → "150.500 kg"
 *   formatQuantity(200, 'pcs')  → "200 pcs"
 */
export function formatQuantity(quantity, unitSymbol = '', maxDecimals = 3) {
  const n = Number(quantity)
  if (isNaN(n)) return `— ${unitSymbol}`.trim()

  // إذا كان الرقم صحيحاً، لا نعرض الكسور
  const decimals = Number.isInteger(n) ? 0 : maxDecimals

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n)

  return unitSymbol ? `${formatted} ${unitSymbol}` : formatted
}

/**
 * تنسيق نسبة مئوية
 * @param {number} value   - القيمة (0-100)
 * @param {number} [decimals=1]
 * @returns {string}
 */
export function formatPercent(value, decimals = 1) {
  const n = Number(value)
  if (isNaN(n)) return '—'
  return `${n.toFixed(decimals)}%`
}

/**
 * تحويل الرقم لحروف عربية صغيرة (للعدد فقط في النصوص)
 * مثل: "منذ 5 دقائق"
 * @param {number} num
 * @returns {string}
 */
function arabicNum(num) {
  // نستخدم الأرقام اللاتينية لوضوحها في السياق العربي
  return String(num)
}

// ══════════════════════════════════════════════════════════════
// 📋 4. تنسيق بيانات الجداول والحركات
// ══════════════════════════════════════════════════════════════

/**
 * الحصول على لون CSS لنوع الحركة (للعرض في الجداول)
 *
 * @param {string} transactionType
 * @param {'text'|'bg'|'border'} [variant='text']
 * @returns {string} CSS class name
 */
export function txTypeColor(transactionType, variant = 'text') {
  const POSITIVE_TYPES = ['stock_in', 'adjustment_add', 'opening_balance', 'transfer_in']
  const isPositive = POSITIVE_TYPES.includes(transactionType)

  const colors = {
    text:   isPositive ? 'text-positive' : 'text-negative',
    bg:     isPositive ? 'rgba(34,197,94,0.1)'  : 'rgba(239,68,68,0.1)',
    border: isPositive ? 'rgba(34,197,94,0.3)'  : 'rgba(239,68,68,0.3)',
  }

  return colors[variant] ?? colors.text
}

/**
 * الحصول على إشارة الحركة (+/-)
 * @param {string} transactionType
 * @returns {'+' | '-'}
 */
export function txSign(transactionType) {
  const POSITIVE = ['stock_in', 'adjustment_add', 'opening_balance', 'transfer_in']
  return POSITIVE.includes(transactionType) ? '+' : '-'
}

/**
 * تنسيق كمية الحركة مع إشارة واللون
 * يُعيد HTML string جاهز للعرض
 *
 * @param {number} quantity
 * @param {string} transactionType
 * @param {string} [unitSymbol]
 * @returns {string} HTML
 */
export function formatTxQuantity(quantity, transactionType, unitSymbol = '') {
  const sign  = txSign(transactionType)
  const color = txTypeColor(transactionType)
  const qty   = formatQuantity(Math.abs(Number(quantity)), unitSymbol)

  // نستخدم textContent لاحقاً — هنا نبني الـ string فقط
  return `${sign}${qty}`
}

// ══════════════════════════════════════════════════════════════
// 🏷️ 5. تنسيق حالة المخزون
// ══════════════════════════════════════════════════════════════

/**
 * تحديد حالة المخزون
 *
 * @param {number} current
 * @param {number|null} minAlert
 * @returns {'zero' | 'low' | 'ok'}
 */
export function stockStatus(current, minAlert = null) {
  const c = Number(current)
  if (c === 0) return 'zero'
  if (minAlert != null && c <= Number(minAlert)) return 'low'
  return 'ok'
}

/**
 * تسمية حالة المخزون بالعربية
 * @param {'zero'|'low'|'ok'} status
 * @returns {string}
 */
export function stockStatusLabel(status) {
  return { zero: 'نفد المخزون', low: 'مخزون منخفض', ok: 'مخزون جيد' }[status] ?? '—'
}

/**
 * CSS class لشارة حالة المخزون
 * @param {'zero'|'low'|'ok'} status
 * @returns {string}
 */
export function stockStatusClass(status) {
  return { zero: 'stock-zero', low: 'stock-low', ok: 'stock-ok' }[status] ?? ''
}

/**
 * أيقونة حالة المخزون (Unicode)
 * @param {'zero'|'low'|'ok'} status
 * @returns {string}
 */
export function stockStatusIcon(status) {
  return { zero: '⛔', low: '⚠️', ok: '✅' }[status] ?? '•'
}

// ══════════════════════════════════════════════════════════════
// 🏢 6. تنسيق متفرق
// ══════════════════════════════════════════════════════════════

/**
 * اختصار نص طويل
 * @param {string} text
 * @param {number} [maxLength=50]
 * @returns {string}
 */
export function truncate(text, maxLength = 50) {
  if (!text) return '—'
  const str = String(text)
  return str.length > maxLength ? str.slice(0, maxLength) + '…' : str
}

/**
 * الحرف الأول من اسم (للـ Avatar)
 * @param {string} name
 * @returns {string}
 */
export function nameInitial(name) {
  if (!name) return '؟'
  const trimmed = String(name).trim()
  return trimmed.charAt(0).toUpperCase() || '؟'
}

/**
 * تنسيق رقم مرجعي — إضافة # إذا لم يكن موجوداً
 * @param {string|null} ref
 * @returns {string}
 */
export function formatRef(ref) {
  if (!ref) return '—'
  return ref.startsWith('#') ? ref : `#${ref}`
}

/**
 * تحويل bytes لـ KB / MB (لعرض أحجام الملفات)
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i     = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

// ══════════════════════════════════════════════════════════════
// 📤 تصدير مجمّع
// ══════════════════════════════════════════════════════════════
export default {
  // عملات
  formatSYP, formatUSD, formatCurrency, usdToSyp, sypToUsd,
  // تواريخ
  formatDate, formatDateShort, timeAgo, toInputDate, todayISO, daysAgoISO,
  // أرقام
  formatNumber, formatQuantity, formatPercent,
  // حركات
  txTypeColor, txSign, formatTxQuantity,
  // مخزون
  stockStatus, stockStatusLabel, stockStatusClass, stockStatusIcon,
  // متفرق
  truncate, nameInitial, formatRef, formatFileSize,
}
