/**
 * src/services/units.service.js
 * ──────────────────────────────────────────────────────────────
 * 📏 خدمة وحدات القياس
 * ──────────────────────────────────────────────────────────────
 */

import { supabase, handleSupabaseError } from '../config/supabase.js'
import { cleanString, cleanUUID } from '../utils/security.js'

/**
 * جلب وحدات القياس
 * @param {boolean} [onlyActive=true]
 * @returns {Promise<{data: object[]|null, error: string|null}>}
 */
export async function getUnits(onlyActive = true) {
  try {
    let query = supabase
      .from('units')
      .select('*')
      .order('name', { ascending: true })

    if (onlyActive) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) return { data: null, error: handleSupabaseError(error) }
    return { data: data ?? [], error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * إضافة وحدة قياس جديدة
 * @param {{ name: string, symbol: string }} unitData
 * @param {string} createdBy
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function createUnit(unitData, createdBy) {
  const cleanedUserId = cleanUUID(createdBy)
  if (!cleanedUserId) return { data: null, error: 'معرّف المستخدم غير صالح' }

  const name = cleanString(unitData.name)
  if (!name || name.length < 2) return { data: null, error: 'اسم الوحدة يجب أن يكون حرفين على الأقل' }
  if (name.length > 50) return { data: null, error: 'اسم الوحدة طويل جداً' }

  const symbol = cleanString(unitData.symbol).replace(/\s/g, '')
  if (!symbol) return { data: null, error: 'رمز الوحدة مطلوب' }
  if (symbol.length > 10) return { data: null, error: 'رمز الوحدة طويل جداً (10 أحرف كحد أقصى)' }

  try {
    const { data, error } = await supabase
      .from('units')
      .insert({ name, symbol, created_by: cleanedUserId })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return { data: null, error: 'اسم الوحدة أو رمزها مستخدم مسبقاً' }
      return { data: null, error: handleSupabaseError(error) }
    }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

/**
 * تبديل حالة الوحدة (تفعيل/تعطيل)
 * @param {string} unitId
 * @param {boolean} isActive
 * @returns {Promise<{error: string|null}>}
 */
export async function toggleUnitActive(unitId, isActive) {
  const cleanedId = cleanUUID(unitId)
  if (!cleanedId) return { error: 'معرّف الوحدة غير صالح' }

  try {
    const { error } = await supabase
      .from('units')
      .update({ is_active: Boolean(isActive) })
      .eq('id', cleanedId)

    if (error) return { error: handleSupabaseError(error) }
    return { error: null }
  } catch (err) {
    return { error: handleSupabaseError(err) }
  }
}
