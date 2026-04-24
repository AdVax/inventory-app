/**
 * src/services/auth.service.js
 * ──────────────────────────────────────────────────────────────
 * 🔐 خدمة المصادقة وإدارة المستخدمين
 *
 * تُغلّف كل عمليات Supabase Auth:
 * - تسجيل الدخول والخروج
 * - جلب بيانات الـ Profile
 * - الاستماع لتغييرات الجلسة
 *
 * 🔒 مبادئ الأمان:
 * - كلمات المرور لا تُخزَّن أو تُسجَّل في أي مكان
 * - الجلسات تُدار حصراً بواسطة Supabase SDK
 * - rate limiting لمحاولات الدخول (3 محاولات → تأخير)
 * - Profile يُجلب من قاعدة البيانات بعد كل دخول
 *   للتأكد من أن الدور والحالة محدّثان
 * ──────────────────────────────────────────────────────────────
 */

import { supabase, handleSupabaseError } from '../config/supabase.js'
import { cleanString } from '../utils/security.js'

// ══════════════════════════════════════════════════════════════
// 🚦 Rate Limiter محلي — لمنع Brute Force من الواجهة
// (الحماية الحقيقية من جانب Supabase - هذا طبقة UX إضافية)
// ══════════════════════════════════════════════════════════════
const loginAttempts = {
  count:     0,
  lastReset: Date.now(),
  MAX:       5,
  WINDOW_MS: 5 * 60 * 1000,  // 5 دقائق
  DELAY_MS:  3 * 1000,        // 3 ثواني تأخير بعد 3 محاولات

  record() {
    const now = Date.now()
    if (now - this.lastReset > this.WINDOW_MS) {
      this.count     = 0
      this.lastReset = now
    }
    this.count++
  },

  isBlocked() {
    const now = Date.now()
    if (now - this.lastReset > this.WINDOW_MS) {
      this.count     = 0
      this.lastReset = now
      return false
    }
    return this.count >= this.MAX
  },

  shouldDelay() {
    return this.count >= 3
  },

  reset() {
    this.count     = 0
    this.lastReset = Date.now()
  },
}

// ══════════════════════════════════════════════════════════════
// 🔑 تسجيل الدخول
// ══════════════════════════════════════════════════════════════

/**
 * تسجيل دخول المستخدم
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{data: import('../store/store.js').UserProfile|null, error: string|null}>}
 */
export async function signIn(email, password) {
  // ── التحقق من المدخلات ─────────────────────────────────────
  const cleanEmail    = cleanString(email).toLowerCase()
  const cleanPassword = cleanString(password)

  if (!cleanEmail || !cleanPassword) {
    return { data: null, error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }
  }

  // التحقق من صيغة البريد
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return { data: null, error: 'صيغة البريد الإلكتروني غير صحيحة' }
  }

  if (cleanPassword.length < 6) {
    return { data: null, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  }

  // ── Rate Limiting ──────────────────────────────────────────
  if (loginAttempts.isBlocked()) {
    return {
      data:  null,
      error: 'تم تجاوز عدد المحاولات المسموح بها. يرجى الانتظار 5 دقائق.',
    }
  }

  // تأخير تدريجي بعد 3 محاولات فاشلة
  if (loginAttempts.shouldDelay()) {
    await new Promise(resolve => setTimeout(resolve, loginAttempts.DELAY_MS))
  }

  loginAttempts.record()

  try {
    // ── 1. مصادقة Supabase ────────────────────────────────────
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email:    cleanEmail,
        password: cleanPassword,
      })

    if (authError || !authData?.user) {
      return { data: null, error: handleSupabaseError(authError) }
    }

    // ── 2. جلب الـ Profile من قاعدة البيانات ──────────────────
    // لا نثق بـ user_metadata — نجلب الـ role من جدول profiles مباشرة
    const { data: profile, error: profileError } =
      await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      return { data: null, error: 'لم يتم العثور على بيانات المستخدم في النظام' }
    }

    // ── 3. التحقق من أن الحساب نشط ───────────────────────────
    if (!profile.is_active) {
      await supabase.auth.signOut()
      return { data: null, error: 'الحساب موقوف. يرجى التواصل مع المدير.' }
    }

    // ── نجح الدخول — إعادة ضبط عداد المحاولات ─────────────────
    loginAttempts.reset()

    return { data: profile, error: null }

  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 🚪 تسجيل الخروج
// ══════════════════════════════════════════════════════════════

/**
 * تسجيل خروج المستخدم
 * @returns {Promise<{error: string|null}>}
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) return { error: handleSupabaseError(error) }
    return { error: null }
  } catch (err) {
    return { error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 👤 جلب بيانات المستخدم الحالي
// ══════════════════════════════════════════════════════════════

/**
 * جلب الـ Profile الكامل للمستخدم الحالي
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getCurrentProfile() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { data: null, error: null }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) return { data: null, error: handleSupabaseError(error) }
    if (!data?.is_active) return { data: null, error: 'الحساب موقوف' }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * جلب Profile مستخدم بمعرّفه
 * (للـ Admin فقط — RLS تمنع الـ Viewer)
 *
 * @param {string} userId
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getProfileById(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active, created_at')
      .eq('id', userId)
      .single()

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * جلب قائمة كل المستخدمين
 * (للـ Admin فقط — RLS تمنع الـ Viewer من رؤية بيانات الآخرين)
 *
 * @returns {Promise<{data: object[]|null, error: string|null}>}
 */
export async function getAllProfiles() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data: data ?? [], error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 🔄 الاستماع لتغييرات حالة المصادقة
// ══════════════════════════════════════════════════════════════

/**
 * الاشتراك في تغييرات الجلسة
 *
 * @param {Function} callback - يُستدعى مع (event, profile|null)
 * @returns {Function} دالة إلغاء الاشتراك
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        callback(event, null)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const { data: profile } = await getCurrentProfile()
        callback(event, profile)
      }
    }
  )

  return () => subscription.unsubscribe()
}
