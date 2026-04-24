/**
 * src/config/supabase.js
 * ──────────────────────────────────────────────────────────────
 * 🔐 الاتصال الآمن بـ Supabase
 *
 * مبادئ الأمان المطبقة في هذا الملف:
 *
 * 1. ANON KEY فقط في الواجهة الأمامية:
 *    - مفتاح الـ Anon Key آمن للعرض في الكود لأن:
 *      أ) جميع الصلاحيات تُحكم بـ RLS في Supabase
 *      ب) حتى لو رآه المستخدم، لا يمكنه تجاوز RLS
 *
 * 2. SERVICE ROLE KEY ممنوع هنا:
 *    - هذا المفتاح يتجاوز RLS ويجب أن يبقى على السيرفر فقط
 *    - لا تضعه هنا أبداً حتى في متغيرات البيئة للـ Frontend
 *
 * 3. الاتصال يعبر HTTPS فقط (Supabase يفرض ذلك)
 *
 * 4. autoRefreshToken: true — تجديد الجلسة تلقائياً
 *
 * 5. detectSessionInUrl: false — منع Session Hijacking
 *    عبر الـ URL fragments
 * ──────────────────────────────────────────────────────────────
 */

// ── استيراد Supabase JS v2 عبر CDN (ESM) ──────────────────────
// نستخدم skypack أو esm.sh لدعم ES Modules بدون بناء
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ══════════════════════════════════════════════════════════════
// ⚙️ إعدادات الاتصال
//
// ❗ كيفية إعداد هذه القيم:
//
// الطريقة 1 — GitHub Pages + Netlify (الطريقة الموصى بها):
//   ضع القيم مباشرة هنا (Anon Key آمن للعرض)
//   لأن الحماية الحقيقية هي RLS في Supabase
//
// الطريقة 2 — للتطوير المحلي:
//   يمكنك استخدام ملف config مستقل
//
// ⚠️ ما يجب تجنبه:
//   - لا تضع Service Role Key هنا أبداً
//   - لا تضع كلمات مرور قاعدة البيانات هنا
// ══════════════════════════════════════════════════════════════

const SUPABASE_CONFIG = {
  // ← استبدل بـ Project URL الخاص بك من Supabase Dashboard
  url: 'https://appvfjzwbansthanixxb.supabase.co',

  // ← استبدل بـ Anon/Public Key الخاص بك
  // (يبدأ بـ eyJ... ويظهر في Project Settings → API)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcHZmanp3YmFuc3RoYW5peHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjI3MjUsImV4cCI6MjA5MjQzODcyNX0.XQyyP1-LnAW9YPeFSece3tVsuOlf-R2i1bxnkEu8JM4',
}

// ══════════════════════════════════════════════════════════════
// 🛡️ التحقق من صحة الإعدادات عند بدء التطبيق
// ══════════════════════════════════════════════════════════════
function validateConfig() {
  const errors = []

  if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID')) {
    errors.push('⚠️ SUPABASE URL غير مضبوط في src/config/supabase.js')
  }

  if (!SUPABASE_CONFIG.anonKey || SUPABASE_CONFIG.anonKey.includes('YOUR_ANON_KEY')) {
    errors.push('⚠️ SUPABASE ANON KEY غير مضبوط في src/config/supabase.js')
  }

  // التحقق من أن الـ URL يشير لـ Supabase
  if (
    SUPABASE_CONFIG.url &&
    !SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID') &&
    !SUPABASE_CONFIG.url.includes('.supabase.co')
  ) {
    errors.push('⚠️ SUPABASE URL يجب أن ينتهي بـ .supabase.co')
  }

  // التحقق من أنه ليس Service Role Key
  // (Service Role Key يحتوي على "service_role" في الـ payload المفكوك)
  if (SUPABASE_CONFIG.anonKey && !SUPABASE_CONFIG.anonKey.includes('YOUR_ANON_KEY')) {
    try {
      const payload = JSON.parse(atob(SUPABASE_CONFIG.anonKey.split('.')[1]))
      if (payload.role === 'service_role') {
        // هذا خطر أمني حرج — نوقف التطبيق تماماً
        document.body.innerHTML = `
          <div style="
            min-height:100vh; background:#0f172a; display:flex;
            align-items:center; justify-content:center; font-family:Tajawal,sans-serif;
            direction:rtl; padding:2rem;
          ">
            <div style="background:#1e293b; border:2px solid #ef4444; border-radius:16px; padding:2rem; max-width:500px; text-align:center;">
              <p style="color:#ef4444; font-size:1.5rem; font-weight:900; margin-bottom:1rem;">🚨 خطر أمني حرج</p>
              <p style="color:#fca5a5; line-height:1.6;">
                تم اكتشاف <strong>Service Role Key</strong> في الكود الأمامي.<br>
                هذا المفتاح يتجاوز جميع قواعد الأمان (RLS) ويجب
                <strong>إزالته فوراً</strong> واستبداله بـ Anon Key.
              </p>
            </div>
          </div>
        `
        throw new Error('CRITICAL: Service Role Key found in frontend code!')
      }
    } catch (e) {
      if (e.message.includes('CRITICAL')) throw e
      // JWT غير صالح — نتجاهل الخطأ ونتابع
    }
  }

  return errors
}

// ══════════════════════════════════════════════════════════════
// 🔧 إنشاء Supabase Client
// ══════════════════════════════════════════════════════════════
const configErrors = validateConfig()

// عرض رسائل التحذير في وضع التطوير
if (configErrors.length > 0) {
  console.group('🔧 Supabase Configuration Required:')
  configErrors.forEach(err => console.warn(err))
  console.info('📖 افتح src/config/supabase.js وأضف بيانات مشروعك')
  console.groupEnd()
}

/**
 * @type {import('@supabase/supabase-js').SupabaseClient}
 *
 * 🔐 خيارات الأمان:
 * - persistSession: true     → حفظ الجلسة في localStorage
 * - autoRefreshToken: true   → تجديد تلقائي قبل انتهاء الصلاحية
 * - detectSessionInUrl: false → منع استخراج التوكن من الـ URL
 * - flowType: 'pkce'         → أعلى مستوى أمان للـ Auth flow
 */
export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: false,
      flowType:           'pkce',  // أأمن من implicit flow
    },

    // إعدادات Realtime (معطلة افتراضياً لتوفير الموارد)
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },

    // Global Headers — تُضاف لكل طلب
    global: {
      headers: {
        'X-Client-Info': 'inventory-erp/1.0',
      },
    },
  }
)

// ══════════════════════════════════════════════════════════════
// 🔐 Helper Functions — دوال مساعدة آمنة
// ══════════════════════════════════════════════════════════════

/**
 * جلب الجلسة الحالية بأمان
 * @returns {Promise<import('@supabase/supabase-js').Session|null>}
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Session error:', error.message)
    return null
  }
  return session
}

/**
 * التحقق من أن المستخدم مسجل الدخول
 * ⚠️ لا تستخدم هذا كضمان أمني — الـ RLS هي الضمان الحقيقي
 * استخدمه فقط لإخفاء/إظهار عناصر الواجهة
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const session = await getSession()
  return session !== null
}

/**
 * معالج موحد لأخطاء Supabase
 * يحول رسائل الخطأ التقنية إلى رسائل عربية مفهومة
 * @param {import('@supabase/supabase-js').PostgrestError | Error} error
 * @returns {string} رسالة خطأ عربية
 */
export function handleSupabaseError(error) {
  if (!error) return 'حدث خطأ غير معروف'

  const message = error.message || error.toString()
  const code    = error.code    || ''

  // أخطاء المصادقة
  if (message.includes('Invalid login credentials') || code === 'invalid_credentials') {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
  }
  if (message.includes('Email not confirmed')) {
    return 'يرجى تفعيل حسابك عبر البريد الإلكتروني أولاً'
  }
  if (message.includes('Too many requests')) {
    return 'محاولات تسجيل دخول متعددة. يرجى الانتظار دقيقة'
  }
  if (message.includes('User not found')) {
    return 'المستخدم غير موجود في النظام'
  }
  if (message.includes('JWT expired') || code === 'PGRST301') {
    return 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً'
  }

  // أخطاء RLS / Permissions
  if (message.includes('new row violates row-level security') || code === '42501') {
    return 'ليس لديك صلاحية لتنفيذ هذه العملية'
  }
  if (message.includes('permission denied')) {
    return 'رُفض طلبك: ليس لديك الصلاحية الكافية'
  }

  // أخطاء المحاسبة (من الـ Triggers)
  if (message.includes('المخزون لا يمكن أن يكون سالباً')) {
    return message // نعرض رسالة الـ Trigger كما هي
  }
  if (message.includes('يُمنع تعديل أو حذف')) {
    return message
  }
  if (message.includes('لا يمكن حذف المادة')) {
    return message
  }

  // أخطاء قاعدة البيانات
  if (code === '23505') {
    return 'هذه البيانات موجودة مسبقاً (تكرار)'
  }
  if (code === '23503') {
    return 'البيانات المُشار إليها غير موجودة'
  }
  if (code === '23514') {
    return 'البيانات المُدخلة لا تستوفي شروط الصحة'
  }
  if (code === '22P02') {
    return 'صيغة البيانات غير صحيحة'
  }

  // أخطاء الشبكة
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'لا يمكن الاتصال بالسيرفر. تحقق من اتصالك بالإنترنت'
  }

  // رسالة عامة إذا لم يُعرف الخطأ
  // نسجل التفاصيل في Console للمطور دون عرضها للمستخدم
  if (import.meta?.env?.DEV || SUPABASE_CONFIG.url.includes('localhost')) {
    console.error('Supabase Error Details:', error)
  }

  return 'حدث خطأ في العملية. يرجى المحاولة مرة أخرى'
}

/**
 * تنفيذ RPC (Stored Procedure) بأمان
 * @param {string} functionName اسم الدالة في Supabase
 * @param {object} params المعاملات
 * @returns {Promise<{data: any, error: string|null}>}
 */
export async function callRpc(functionName, params = {}) {
  try {
    const { data, error } = await supabase.rpc(functionName, params)
    if (error) throw error
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 🚦 التحقق من حالة الاتصال عند التشغيل
// ══════════════════════════════════════════════════════════════
// هذا يتم بهدوء — لا يظهر للمستخدم إلا عند وجود مشكلة حقيقية
;(async () => {
  if (configErrors.length === 0) {
    try {
      await supabase.from('profiles').select('id').limit(1)
      // لا نحتاج نتيجة — فقط نتحقق من أن الاتصال يعمل
    } catch {
      // الاتصال فاشل — سيظهر الخطأ للمستخدم عند محاولة تسجيل الدخول
    }
  }
})()
