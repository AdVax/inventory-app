/**
 * src/services/settings.service.js
 * ──────────────────────────────────────────────────────────────
 * ⚙️ خدمة إعدادات الشركة وأسعار الصرف
 *
 * 🔒 مبادئ الأمان:
 * - RLS تمنع الـ Viewer من التعديل (طبقة السيرفر)
 * - نتحقق من الصلاحيات في الـ UI أيضاً (طبقة UX)
 * - أسعار الصرف التاريخية محمية من التعديل والحذف بـ RLS
 * - يوم واحد = سعر واحد (UNIQUE constraint في قاعدة البيانات)
 * ──────────────────────────────────────────────────────────────
 */

import { supabase, handleSupabaseError } from '../config/supabase.js'
import { cleanString, cleanNumber, cleanDate, cleanUUID } from '../utils/security.js'

// ══════════════════════════════════════════════════════════════
// 🏢 إعدادات الشركة
// ══════════════════════════════════════════════════════════════

/**
 * جلب إعدادات الشركة (صف واحد دائماً - id=1)
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getCompanySettings() {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * تحديث إعدادات الشركة
 * (Admin فقط — RLS تمنع الـ Viewer)
 *
 * @param {object} updates
 * @param {string} [updates.company_name]
 * @param {string} [updates.phone]
 * @param {string} [updates.address]
 * @param {string} [updates.fiscal_year_start]
 * @param {string} updatedBy - UUID المستخدم الذي يُعدّل
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function updateCompanySettings(updates, updatedBy) {
  // ── تنظيف المدخلات ─────────────────────────────────────────
  const cleanedUserId = cleanUUID(updatedBy)
  if (!cleanedUserId) {
    return { data: null, error: 'معرّف المستخدم غير صالح' }
  }

  const payload = {}

  if (updates.company_name !== undefined) {
    const name = cleanString(updates.company_name)
    if (!name || name.length < 2) {
      return { data: null, error: 'اسم الشركة يجب أن يكون حرفين على الأقل' }
    }
    if (name.length > 100) {
      return { data: null, error: 'اسم الشركة طويل جداً (100 حرف كحد أقصى)' }
    }
    payload.company_name = name
  }

  if (updates.phone !== undefined) {
    payload.phone = updates.phone
      ? cleanString(updates.phone).replace(/[^\d\s+\-()]/g, '').slice(0, 20)
      : null
  }

  if (updates.address !== undefined) {
    payload.address = updates.address
      ? cleanString(updates.address).slice(0, 200)
      : null
  }

  if (updates.fiscal_year_start !== undefined) {
    payload.fiscal_year_start = updates.fiscal_year_start
      ? cleanDate(updates.fiscal_year_start)
      : null
  }

  if (Object.keys(payload).length === 0) {
    return { data: null, error: 'لا توجد تغييرات للحفظ' }
  }

  payload.updated_by = cleanedUserId

  // ── الإرسال لقاعدة البيانات ────────────────────────────────
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .update(payload)
      .eq('id', 1)
      .select()
      .single()

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 💱 أسعار الصرف
// ══════════════════════════════════════════════════════════════

/**
 * جلب آخر سعر صرف مسجل
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getLatestExchangeRate() {
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * جلب تاريخ أسعار الصرف
 * @param {number} [limit=30]
 * @returns {Promise<{data: object[]|null, error: string|null}>}
 */
export async function getExchangeRateHistory(limit = 30) {
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 30), 365)

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('id, rate_date, usd_to_syp, notes, created_at')
      .order('rate_date', { ascending: false })
      .limit(safeLimit)

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data: data ?? [], error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * إضافة سعر صرف جديد
 * (Admin فقط — يوم واحد = سعر واحد)
 *
 * @param {object} rateData
 * @param {string} rateData.rate_date  - YYYY-MM-DD
 * @param {number} rateData.usd_to_syp - الرقم الموجب
 * @param {string} [rateData.notes]
 * @param {string} createdBy - UUID المستخدم
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function createExchangeRate(rateData, createdBy) {
  // ── تنظيف وتحقق ───────────────────────────────────────────
  const cleanedUserId = cleanUUID(createdBy)
  if (!cleanedUserId) return { data: null, error: 'معرّف المستخدم غير صالح' }

  const rateDate = cleanDate(rateData.rate_date, false)
  if (!rateDate) return { data: null, error: 'التاريخ غير صحيح' }

  // لا نسمح بتواريخ أكثر من يوم واحد في المستقبل
  const dateObj = new Date(rateDate)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateObj > tomorrow) {
    return { data: null, error: 'لا يمكن تسجيل سعر لتاريخ مستقبلي بعيد' }
  }

  const rate = cleanNumber(rateData.usd_to_syp, { min: 1, max: 10_000_000 })
  if (!rate) return { data: null, error: 'سعر الصرف يجب أن يكون رقماً موجباً أكبر من صفر' }

  const notes = rateData.notes
    ? cleanString(rateData.notes).slice(0, 200)
    : null

  // ── التحقق من عدم وجود سعر لهذا اليوم مسبقاً ─────────────
  // (قاعدة البيانات لديها UNIQUE constraint لكن نتحقق مسبقاً لرسالة أوضح)
  const existing = await getExchangeRateByDate(rateDate)
  if (existing.data) {
    return {
      data:  null,
      error: `يوجد سعر صرف مسجل بالفعل ليوم ${formatDateArabic(rateDate)} (${existing.data.usd_to_syp.toLocaleString('ar')} ل.س). أسعار الصرف التاريخية محمية من التعديل.`,
    }
  }

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .insert({
        rate_date:  rateDate,
        usd_to_syp: rate,
        notes,
        created_by: cleanedUserId,
      })
      .select()
      .single()

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * جلب سعر صرف بتاريخ محدد
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getExchangeRateByDate(date) {
  const cleanedDate = cleanDate(date)
  if (!cleanedDate) return { data: null, error: 'التاريخ غير صحيح' }

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('rate_date', cleanedDate)
      .maybeSingle()

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 🔧 دالة مساعدة
// ══════════════════════════════════════════════════════════════
function formatDateArabic(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('ar-SY', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return dateStr
  }
}
