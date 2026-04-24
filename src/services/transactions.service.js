/**
 * src/services/transactions.service.js
 * ──────────────────────────────────────────────────────────────
 * 📋 خدمة الحركات المحاسبية — القلب النابض للنظام
 *
 * 🔒 القواعد المحاسبية الصارمة:
 *
 * 1. لا تعديل (No Update):
 *    - لا يوجد دالة update() هنا
 *    - Trigger في قاعدة البيانات يمنع أي UPDATE
 *    - RLS لا تسمح بـ UPDATE أصلاً
 *
 * 2. لا حذف (No Delete):
 *    - لا يوجد دالة delete() هنا
 *    - Trigger يمنع أي DELETE
 *    - RLS لا تسمح بـ DELETE أصلاً
 *
 * 3. تصحيح الأخطاء = حركة جديدة:
 *    - استخدم adjustment_add / adjustment_sub
 *    - كل تصحيح موثق بـ (من، متى، لماذا)
 *
 * 4. الـ stock_before/stock_after يُحسب بواسطة Trigger:
 *    - لا نُرسله في الـ INSERT
 *    - الـ Trigger يحسبه ويحفظه ذرياً (Atomically)
 *
 * 5. منع الرصيد السالب:
 *    - Trigger في قاعدة البيانات يرفض العملية
 *    - نُظهر رسالة خطأ واضحة للمستخدم
 * ──────────────────────────────────────────────────────────────
 */

import { supabase, handleSupabaseError } from '../config/supabase.js'
import {
  cleanString, cleanNumber, cleanUUID, cleanDate,
  cleanTransactionType,
} from '../utils/security.js'

// أنواع الحركات المتاحة
export const TRANSACTION_TYPES = {
  stock_in:        { label: 'إدخال بضاعة',      direction: +1, icon: '📥' },
  stock_out:       { label: 'إخراج / صرف',       direction: -1, icon: '📤' },
  adjustment_add:  { label: 'تسوية جردية +',     direction: +1, icon: '➕' },
  adjustment_sub:  { label: 'تسوية جردية -',     direction: -1, icon: '➖' },
  disposal:        { label: 'إتلاف / خسارة',     direction: -1, icon: '🗑️' },
  opening_balance: { label: 'رصيد افتتاحي',      direction: +1, icon: '🏁' },
  transfer_in:     { label: 'تحويل وارد',         direction: +1, icon: '↩️' },
  transfer_out:    { label: 'تحويل صادر',         direction: -1, icon: '↪️' },
}

// ══════════════════════════════════════════════════════════════
// 📖 جلب الحركات
// ══════════════════════════════════════════════════════════════

/**
 * جلب سجل الحركات مع فلاتر
 *
 * @param {object} [filters]
 * @param {string}  [filters.materialId]
 * @param {string}  [filters.type]       - نوع الحركة
 * @param {string}  [filters.dateFrom]   - YYYY-MM-DD
 * @param {string}  [filters.dateTo]     - YYYY-MM-DD
 * @param {string}  [filters.createdBy]  - UUID
 * @param {number}  [filters.limit=100]
 * @param {number}  [filters.offset=0]   - للتصفح بالصفحات
 * @returns {Promise<{data: object[]|null, count: number, error: string|null}>}
 */
export async function getTransactions(filters = {}) {
  try {
    let query = supabase
      .from('transactions')
      .select(`
        id,
        material_id,
        transaction_type,
        quantity,
        stock_before,
        stock_after,
        unit_cost_syp,
        unit_cost_usd,
        exchange_rate,
        reference_number,
        notes,
        created_at,
        created_by,
        materials ( name, code, units(symbol) ),
        profiles  ( full_name )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // ── تطبيق الفلاتر ─────────────────────────────────────────
    if (filters.materialId) {
      const mid = cleanUUID(filters.materialId)
      if (mid) query = query.eq('material_id', mid)
    }

    if (filters.type) {
      const t = cleanTransactionType(filters.type)
      if (t) query = query.eq('transaction_type', t)
    }

    if (filters.dateFrom) {
      const d = cleanDate(filters.dateFrom)
      if (d) query = query.gte('created_at', `${d}T00:00:00.000Z`)
    }

    if (filters.dateTo) {
      const d = cleanDate(filters.dateTo)
      if (d) query = query.lte('created_at', `${d}T23:59:59.999Z`)
    }

    if (filters.createdBy) {
      const uid = cleanUUID(filters.createdBy)
      if (uid) query = query.eq('created_by', uid)
    }

    // Pagination
    const limit  = Math.min(Math.max(1, parseInt(filters.limit)  || 100), 500)
    const offset = Math.max(0, parseInt(filters.offset) || 0)
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) return { data: null, count: 0, error: handleSupabaseError(error) }

    return {
      data:  (data ?? []).map(flattenTransaction),
      count: count ?? 0,
      error: null,
    }
  } catch (err) {
    return { data: null, count: 0, error: handleSupabaseError(err) }
  }
}

/**
 * جلب حركات مادة معينة
 * @param {string} materialId
 * @param {number} [limit=50]
 * @returns {Promise<{data: object[]|null, error: string|null}>}
 */
export async function getTransactionsByMaterial(materialId, limit = 50) {
  const cleanedId = cleanUUID(materialId)
  if (!cleanedId) return { data: null, error: 'معرّف المادة غير صالح' }

  const { data, error } = await getTransactions({
    materialId: cleanedId,
    limit,
  })

  return { data, error }
}

// ══════════════════════════════════════════════════════════════
// ➕ تسجيل حركة جديدة
// ══════════════════════════════════════════════════════════════

/**
 * تسجيل حركة محاسبية جديدة
 *
 * ⚠️ هذه العملية ذرية (Atomic):
 * - Trigger يحسب stock_before/stock_after
 * - Trigger يُحدّث current_stock في جدول materials
 * - إذا فشلت أي خطوة، تُلغى كل العملية (Rollback)
 *
 * @param {object} txData
 * @param {string} txData.material_id
 * @param {string} txData.transaction_type
 * @param {number} txData.quantity           - موجب دائماً
 * @param {number} [txData.unit_cost_syp]
 * @param {number} [txData.unit_cost_usd]
 * @param {number} [txData.exchange_rate]
 * @param {string} [txData.reference_number]
 * @param {string} [txData.notes]
 * @param {string} createdBy
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function createTransaction(txData, createdBy) {
  // ── تنظيف وتحقق من المدخلات ──────────────────────────────
  const cleanedUserId = cleanUUID(createdBy)
  if (!cleanedUserId) return { data: null, error: 'معرّف المستخدم غير صالح' }

  const materialId = cleanUUID(txData.material_id)
  if (!materialId)  return { data: null, error: 'يجب اختيار مادة' }

  const txType = cleanTransactionType(txData.transaction_type)
  if (!txType)      return { data: null, error: 'نوع الحركة غير صالح' }

  // الكمية يجب أن تكون موجبة وأكبر من صفر
  const quantity = cleanNumber(txData.quantity, { min: 0.001, max: 999_999_999 })
  if (!quantity)    return { data: null, error: 'الكمية يجب أن تكون رقماً موجباً أكبر من صفر' }

  // التحقق من أن الكمية ليست ذات دقة مبالغ فيها (أكثر من 3 خانات عشرية)
  if (String(quantity).includes('.') && String(quantity).split('.')[1].length > 3) {
    return { data: null, error: 'الكمية لا تقبل أكثر من 3 خانات عشرية' }
  }

  // الأسعار — اختيارية
  const unitCostSyp = txData.unit_cost_syp
    ? (cleanNumber(txData.unit_cost_syp, { min: 0 }) ?? 0)
    : 0

  const unitCostUsd = txData.unit_cost_usd
    ? (cleanNumber(txData.unit_cost_usd, { min: 0 }) ?? 0)
    : 0

  const exchangeRate = txData.exchange_rate
    ? cleanNumber(txData.exchange_rate, { min: 0 })
    : null

  // الرقم المرجعي — اختياري
  const refNumber = txData.reference_number
    ? cleanString(txData.reference_number).slice(0, 50)
    : null

  // الملاحظات — اختيارية (إلزامية للإتلاف توثيقياً لكن ليس تقنياً)
  const notes = txData.notes
    ? cleanString(txData.notes).slice(0, 500)
    : null

  // ── تحذير بدون إيقاف: الإتلاف بدون ملاحظات ──────────────
  if (txType === 'disposal' && !notes) {
    console.warn('⚠️ Disposal transaction without notes — consider adding a reason')
  }

  const payload = {
    material_id:      materialId,
    transaction_type: txType,
    quantity,
    unit_cost_syp:    unitCostSyp,
    unit_cost_usd:    unitCostUsd,
    exchange_rate:    exchangeRate,
    reference_number: refNumber,
    notes,
    created_by:       cleanedUserId,
    // ⚠️ لا نُرسل stock_before / stock_after — يحسبها الـ Trigger
  }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select(`
        *,
        materials ( name, code, units(symbol) ),
        profiles  ( full_name )
      `)
      .single()

    if (error) {
      // خطأ المخزون السالب من Trigger
      if (error.message?.includes('المخزون لا يمكن أن يكون سالباً') ||
          error.message?.includes('الكمية الحالية')) {
        return { data: null, error: error.message }
      }
      return { data: null, error: handleSupabaseError(error) }
    }

    return { data: flattenTransaction(data), error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 📊 إحصائيات الحركات (للتقارير)
// ══════════════════════════════════════════════════════════════

/**
 * جلب ملخص إحصائي للحركات في فترة معينة
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo   - YYYY-MM-DD
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getTransactionsSummary(dateFrom, dateTo) {
  const from = cleanDate(dateFrom)
  const to   = cleanDate(dateTo)

  if (!from || !to) return { data: null, error: 'نطاق التاريخ غير صحيح' }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('transaction_type, quantity, unit_cost_syp, unit_cost_usd')
      .gte('created_at', `${from}T00:00:00.000Z`)
      .lte('created_at', `${to}T23:59:59.999Z`)

    if (error) return { data: null, error: handleSupabaseError(error) }

    // حساب الإحصائيات محلياً
    const summary = {
      total_transactions: data.length,
      by_type:            {},
      total_in_qty:       0,
      total_out_qty:      0,
      total_in_value_syp: 0,
      total_out_value_syp: 0,
    }

    for (const tx of data ?? []) {
      const typeInfo = TRANSACTION_TYPES[tx.transaction_type]
      if (!typeInfo) continue

      if (!summary.by_type[tx.transaction_type]) {
        summary.by_type[tx.transaction_type] = { count: 0, total_qty: 0 }
      }
      summary.by_type[tx.transaction_type].count++
      summary.by_type[tx.transaction_type].total_qty += Number(tx.quantity)

      if (typeInfo.direction === +1) {
        summary.total_in_qty        += Number(tx.quantity)
        summary.total_in_value_syp  += Number(tx.quantity) * Number(tx.unit_cost_syp ?? 0)
      } else {
        summary.total_out_qty       += Number(tx.quantity)
        summary.total_out_value_syp += Number(tx.quantity) * Number(tx.unit_cost_syp ?? 0)
      }
    }

    return { data: summary, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 🔧 دوال مساعدة
// ══════════════════════════════════════════════════════════════

/**
 * تسطيح بيانات الحركة من Supabase JOIN
 */
function flattenTransaction(row) {
  if (!row) return null
  return {
    id:               row.id,
    material_id:      row.material_id,
    material_name:    row.materials?.name   ?? '—',
    material_code:    row.materials?.code   ?? null,
    unit_symbol:      row.materials?.units?.symbol ?? '—',
    transaction_type: row.transaction_type,
    type_label:       TRANSACTION_TYPES[row.transaction_type]?.label ?? row.transaction_type,
    type_direction:   TRANSACTION_TYPES[row.transaction_type]?.direction ?? 0,
    type_icon:        TRANSACTION_TYPES[row.transaction_type]?.icon ?? '•',
    quantity:         Number(row.quantity),
    stock_before:     Number(row.stock_before ?? 0),
    stock_after:      Number(row.stock_after  ?? 0),
    unit_cost_syp:    Number(row.unit_cost_syp ?? 0),
    unit_cost_usd:    Number(row.unit_cost_usd ?? 0),
    exchange_rate:    row.exchange_rate ? Number(row.exchange_rate) : null,
    reference_number: row.reference_number ?? null,
    notes:            row.notes            ?? null,
    created_at:       row.created_at,
    created_by:       row.created_by,
    creator_name:     row.profiles?.full_name ?? '—',
  }
}
