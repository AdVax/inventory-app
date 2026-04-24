/**
 * src/services/materials.service.js
 * ──────────────────────────────────────────────────────────────
 * 📦 خدمة إدارة المواد والبضائع
 *
 * 🔒 مبادئ الأمان المحاسبية:
 *
 * 1. لا حذف نهائي (No Hard Delete):
 *    - لا يوجد دالة delete() في هذه الخدمة
 *    - المادة التي لها حركات تُؤرشف فقط (is_active = false)
 *    - Trigger في قاعدة البيانات يمنع الحذف النهائي أيضاً
 *
 * 2. current_stock لا يُعدَّل يدوياً:
 *    - لا يوجد أي كود يُعدّل current_stock مباشرة
 *    - يُحدَّث فقط بواسطة Trigger عند إدراج حركة
 *
 * 3. RLS تمنع الـ Viewer من INSERT/UPDATE
 * ──────────────────────────────────────────────────────────────
 */

import { supabase, handleSupabaseError } from '../config/supabase.js'
import {
  cleanString, cleanNumber, cleanUUID, cleanDate,
} from '../utils/security.js'

// ══════════════════════════════════════════════════════════════
// 📖 جلب المواد
// ══════════════════════════════════════════════════════════════

/**
 * جلب كل المواد مع بيانات الوحدة
 *
 * @param {object} [options]
 * @param {boolean} [options.includeArchived=false]
 * @param {string}  [options.search] - بحث بالاسم أو الرمز
 * @returns {Promise<{data: object[]|null, error: string|null}>}
 */
export async function getMaterials({ includeArchived = false, search = '' } = {}) {
  try {
    let query = supabase
      .from('materials')
      .select(`
        id, code, name, description, unit_id,
        current_stock, min_stock_alert,
        unit_cost_syp, unit_cost_usd,
        is_active, archived_at, archived_by, archive_reason,
        created_at, updated_at, created_by, updated_by,
        units ( name, symbol )
      `)
      .order('name', { ascending: true })

    if (!includeArchived) {
      query = query.eq('is_active', true)
    }

    // بحث نصي — Supabase يحمي من SQL Injection تلقائياً
    if (search) {
      const safeSearch = cleanString(search).slice(0, 100)
      if (safeSearch) {
        query = query.or(`name.ilike.%${safeSearch}%,code.ilike.%${safeSearch}%`)
      }
    }

    const { data, error } = await query
    if (error) return { data: null, error: handleSupabaseError(error) }

    // تحويل البيانات لشكل مسطّح (Flatten)
    return { data: (data ?? []).map(flattenMaterial), error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * جلب مادة واحدة بمعرّفها
 * @param {string} materialId
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getMaterialById(materialId) {
  const cleanedId = cleanUUID(materialId)
  if (!cleanedId) return { data: null, error: 'معرّف المادة غير صالح' }

  try {
    const { data, error } = await supabase
      .from('materials')
      .select(`
        *, units ( name, symbol )
      `)
      .eq('id', cleanedId)
      .single()

    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data: flattenMaterial(data), error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// ➕ إضافة مادة جديدة
// ══════════════════════════════════════════════════════════════

/**
 * إنشاء مادة جديدة
 *
 * @param {object} materialData
 * @param {string} createdBy - UUID المستخدم
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function createMaterial(materialData, createdBy) {
  // ── تنظيف وتحقق ───────────────────────────────────────────
  const validation = validateMaterialData(materialData)
  if (validation.error) return { data: null, error: validation.error }

  const cleanedUserId = cleanUUID(createdBy)
  if (!cleanedUserId) return { data: null, error: 'معرّف المستخدم غير صالح' }

  const payload = {
    ...validation.cleaned,
    created_by: cleanedUserId,
  }

  try {
    const { data, error } = await supabase
      .from('materials')
      .insert(payload)
      .select(`*, units ( name, symbol )`)
      .single()

    if (error) {
      if (error.code === '23505') return { data: null, error: 'رمز المادة مستخدم مسبقاً' }
      return { data: null, error: handleSupabaseError(error) }
    }

    return { data: flattenMaterial(data), error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// ✏️ تعديل مادة
// ══════════════════════════════════════════════════════════════

/**
 * تعديل بيانات مادة موجودة
 * ⚠️ لا يمكن تعديل current_stock عبر هذه الدالة
 *
 * @param {string} materialId
 * @param {object} updates
 * @param {string} updatedBy
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function updateMaterial(materialId, updates, updatedBy) {
  const cleanedId     = cleanUUID(materialId)
  const cleanedUserId = cleanUUID(updatedBy)

  if (!cleanedId)     return { data: null, error: 'معرّف المادة غير صالح' }
  if (!cleanedUserId) return { data: null, error: 'معرّف المستخدم غير صالح' }

  // ── تنظيف ما تم تمريره فقط ────────────────────────────────
  const payload = { updated_by: cleanedUserId }

  if (updates.name !== undefined) {
    const name = cleanString(updates.name)
    if (!name || name.length < 2) return { data: null, error: 'اسم المادة يجب أن يكون حرفين على الأقل' }
    if (name.length > 150)        return { data: null, error: 'اسم المادة طويل جداً' }
    payload.name = name
  }

  if (updates.code !== undefined) {
    payload.code = updates.code ? cleanString(updates.code).slice(0, 50) : null
  }

  if (updates.description !== undefined) {
    payload.description = updates.description
      ? cleanString(updates.description).slice(0, 500)
      : null
  }

  if (updates.unit_id !== undefined) {
    const uid = cleanUUID(updates.unit_id)
    if (!uid) return { data: null, error: 'معرّف الوحدة غير صالح' }
    payload.unit_id = uid
  }

  if (updates.min_stock_alert !== undefined) {
    payload.min_stock_alert = updates.min_stock_alert !== null && updates.min_stock_alert !== ''
      ? cleanNumber(updates.min_stock_alert, { min: 0 })
      : null
  }

  if (updates.unit_cost_syp !== undefined) {
    payload.unit_cost_syp = cleanNumber(updates.unit_cost_syp, { min: 0 }) ?? 0
  }

  if (updates.unit_cost_usd !== undefined) {
    payload.unit_cost_usd = cleanNumber(updates.unit_cost_usd, { min: 0 }) ?? 0
  }

  // ⛔ منع تعديل current_stock مباشرة
  delete payload.current_stock
  delete payload.is_active
  delete payload.archived_at
  delete payload.archived_by
  delete payload.archive_reason

  if (Object.keys(payload).length === 1) { // فقط updated_by
    return { data: null, error: 'لا توجد تغييرات للحفظ' }
  }

  try {
    const { data, error } = await supabase
      .from('materials')
      .update(payload)
      .eq('id', cleanedId)
      .eq('is_active', true)  // لا نعدّل مادة مؤرشفة
      .select(`*, units ( name, symbol )`)
      .single()

    if (error) {
      if (error.code === '23505') return { data: null, error: 'رمز المادة مستخدم مسبقاً' }
      return { data: null, error: handleSupabaseError(error) }
    }

    if (!data) return { data: null, error: 'المادة غير موجودة أو مؤرشفة بالفعل' }

    return { data: flattenMaterial(data), error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 🗃️ أرشفة مادة (Soft Delete)
// لا يوجد Hard Delete — هذه هي الطريقة الوحيدة للإخفاء
// ══════════════════════════════════════════════════════════════

/**
 * أرشفة مادة (إخفاؤها من القوائم مع الاحتفاظ بتاريخها)
 *
 * @param {string} materialId
 * @param {string} reason - سبب الأرشفة (إلزامي للتوثيق)
 * @param {string} archivedBy
 * @returns {Promise<{error: string|null}>}
 */
export async function archiveMaterial(materialId, reason, archivedBy) {
  const cleanedId     = cleanUUID(materialId)
  const cleanedUserId = cleanUUID(archivedBy)

  if (!cleanedId)     return { error: 'معرّف المادة غير صالح' }
  if (!cleanedUserId) return { error: 'معرّف المستخدم غير صالح' }

  const cleanedReason = cleanString(reason)
  if (!cleanedReason || cleanedReason.length < 5) {
    return { error: 'سبب الأرشفة مطلوب للتوثيق المحاسبي (5 أحرف على الأقل)' }
  }

  try {
    const { error } = await supabase
      .from('materials')
      .update({
        is_active:      false,
        archived_at:    new Date().toISOString(),
        archived_by:    cleanedUserId,
        archive_reason: cleanedReason.slice(0, 500),
        updated_by:     cleanedUserId,
      })
      .eq('id', cleanedId)
      .eq('is_active', true)  // نتأكد أنها ليست مؤرشفة بالفعل

    if (error) return { error: handleSupabaseError(error) }
    return { error: null }
  } catch (err) {
    return { error: handleSupabaseError(err) }
  }
}

/**
 * إعادة تفعيل مادة مؤرشفة
 * @param {string} materialId
 * @param {string} updatedBy
 * @returns {Promise<{error: string|null}>}
 */
export async function restoreMaterial(materialId, updatedBy) {
  const cleanedId     = cleanUUID(materialId)
  const cleanedUserId = cleanUUID(updatedBy)

  if (!cleanedId || !cleanedUserId) return { error: 'بيانات غير صالحة' }

  try {
    const { error } = await supabase
      .from('materials')
      .update({
        is_active:      true,
        archived_at:    null,
        archived_by:    null,
        archive_reason: null,
        updated_by:     cleanedUserId,
      })
      .eq('id', cleanedId)

    if (error) return { error: handleSupabaseError(error) }
    return { error: null }
  } catch (err) {
    return { error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 🔧 دوال مساعدة خاصة
// ══════════════════════════════════════════════════════════════

/**
 * التحقق من صحة بيانات المادة وتنظيفها
 * @param {object} data
 * @returns {{ cleaned: object, error: string|null }}
 */
function validateMaterialData(data) {
  const cleaned = {}

  // الاسم — إلزامي
  const name = cleanString(data.name)
  if (!name || name.length < 2) return { cleaned: {}, error: 'اسم المادة يجب أن يكون حرفين على الأقل' }
  if (name.length > 150)        return { cleaned: {}, error: 'اسم المادة طويل جداً (150 حرف كحد أقصى)' }
  cleaned.name = name

  // الوحدة — إلزامية
  const unitId = cleanUUID(data.unit_id)
  if (!unitId) return { cleaned: {}, error: 'وحدة القياس مطلوبة' }
  cleaned.unit_id = unitId

  // الرمز — اختياري
  if (data.code) {
    cleaned.code = cleanString(data.code).slice(0, 50) || null
  }

  // الوصف — اختياري
  if (data.description) {
    cleaned.description = cleanString(data.description).slice(0, 500) || null
  }

  // حد التنبيه — اختياري
  if (data.min_stock_alert !== undefined && data.min_stock_alert !== null && data.min_stock_alert !== '') {
    const alert = cleanNumber(data.min_stock_alert, { min: 0 })
    if (alert === null) return { cleaned: {}, error: 'حد التنبيه يجب أن يكون رقماً موجباً' }
    cleaned.min_stock_alert = alert
  }

  // الأسعار — اختيارية
  if (data.unit_cost_syp !== undefined && data.unit_cost_syp !== '') {
    cleaned.unit_cost_syp = cleanNumber(data.unit_cost_syp, { min: 0 }) ?? 0
  }

  if (data.unit_cost_usd !== undefined && data.unit_cost_usd !== '') {
    cleaned.unit_cost_usd = cleanNumber(data.unit_cost_usd, { min: 0 }) ?? 0
  }

  return { cleaned, error: null }
}

/**
 * تسطيح بيانات المادة من Supabase JOIN
 * @param {object} row
 * @returns {object}
 */
function flattenMaterial(row) {
  if (!row) return null
  return {
    id:              row.id,
    code:            row.code            ?? null,
    name:            row.name,
    description:     row.description     ?? null,
    unit_id:         row.unit_id,
    unit_name:       row.units?.name     ?? '—',
    unit_symbol:     row.units?.symbol   ?? '—',
    current_stock:   Number(row.current_stock   ?? 0),
    min_stock_alert: row.min_stock_alert != null ? Number(row.min_stock_alert) : null,
    unit_cost_syp:   Number(row.unit_cost_syp   ?? 0),
    unit_cost_usd:   Number(row.unit_cost_usd   ?? 0),
    is_active:       row.is_active,
    archived_at:     row.archived_at     ?? null,
    archived_by:     row.archived_by     ?? null,
    archive_reason:  row.archive_reason  ?? null,
    created_at:      row.created_at,
    updated_at:      row.updated_at,
    created_by:      row.created_by,
    updated_by:      row.updated_by      ?? null,
  }
}
