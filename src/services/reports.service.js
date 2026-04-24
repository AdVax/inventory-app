/**
 * src/services/reports.service.js
 * ──────────────────────────────────────────────────────────────
 * 📊 خدمة التقارير ولوحة القيادة
 *
 * تجمع البيانات من عدة جداول وتحسب:
 * - ملخص المخزون الحالي
 * - قيمة المخزون الإجمالية
 * - أكثر المواد نشاطاً
 * - حركات الفترة الزمنية
 * ──────────────────────────────────────────────────────────────
 */

import { supabase, handleSupabaseError } from '../config/supabase.js'
import { cleanDate, cleanUUID } from '../utils/security.js'
import { TRANSACTION_TYPES } from './transactions.service.js'

// ══════════════════════════════════════════════════════════════
// 🏠 بيانات لوحة القيادة
// ══════════════════════════════════════════════════════════════

/**
 * جلب ملخص الـ Dashboard دفعة واحدة (أداء أفضل)
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getDashboardSummary() {
  try {
    // تشغيل كل الاستعلامات بالتوازي
    const [materialsRes, recentTxRes] = await Promise.all([
      // ملخص المواد
      supabase
        .from('materials')
        .select('id, name, code, current_stock, min_stock_alert, unit_cost_syp, unit_cost_usd, is_active, units(symbol)')
        .eq('is_active', true),

      // آخر 10 حركات
      supabase
        .from('transactions')
        .select(`
          id, transaction_type, quantity, created_at,
          materials ( name ),
          profiles  ( full_name )
        `)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (materialsRes.error) throw materialsRes.error
    if (recentTxRes.error)  throw recentTxRes.error

    const materials = materialsRes.data ?? []
    const recentTx  = recentTxRes.data  ?? []

    // ── حساب إحصائيات المخزون ─────────────────────────────
    const zeroStock    = materials.filter(m => m.current_stock === 0)
    const lowStock     = materials.filter(m =>
      m.min_stock_alert != null &&
      m.current_stock > 0 &&
      m.current_stock <= m.min_stock_alert
    )
    const healthyStock = materials.filter(m =>
      m.current_stock > 0 &&
      (m.min_stock_alert == null || m.current_stock > m.min_stock_alert)
    )

    const totalValueSYP = materials.reduce(
      (sum, m) => sum + (Number(m.current_stock) * Number(m.unit_cost_syp ?? 0)), 0
    )
    const totalValueUSD = materials.reduce(
      (sum, m) => sum + (Number(m.current_stock) * Number(m.unit_cost_usd ?? 0)), 0
    )

    // ── تجهيز آخر الحركات ─────────────────────────────────
    const formattedTx = recentTx.map(tx => ({
      id:               tx.id,
      material_name:    tx.materials?.name ?? '—',
      transaction_type: tx.transaction_type,
      type_label:       TRANSACTION_TYPES[tx.transaction_type]?.label ?? tx.transaction_type,
      type_direction:   TRANSACTION_TYPES[tx.transaction_type]?.direction ?? 0,
      type_icon:        TRANSACTION_TYPES[tx.transaction_type]?.icon ?? '•',
      quantity:         Number(tx.quantity),
      creator_name:     tx.profiles?.full_name ?? '—',
      created_at:       tx.created_at,
    }))

    return {
      data: {
        stock: {
          total:          materials.length,
          zero_count:     zeroStock.length,
          low_count:      lowStock.length,
          healthy_count:  healthyStock.length,
          total_value_syp: totalValueSYP,
          total_value_usd: totalValueUSD,
          zero_items:     zeroStock.slice(0, 5).map(m => ({
            id: m.id, name: m.name, current_stock: Number(m.current_stock),
            unit_symbol: m.units?.symbol ?? '—',
          })),
          low_items:      lowStock.slice(0, 5).map(m => ({
            id: m.id, name: m.name,
            current_stock: Number(m.current_stock),
            min_stock_alert: Number(m.min_stock_alert),
            unit_symbol: m.units?.symbol ?? '—',
          })),
        },
        recent_transactions: formattedTx,
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 📦 تقرير المخزون التفصيلي
// ══════════════════════════════════════════════════════════════

/**
 * @returns {Promise<{data: object[]|null, error: string|null}>}
 */
export async function getInventoryReport() {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('id, code, name, current_stock, min_stock_alert, unit_cost_syp, unit_cost_usd, is_active, units(name, symbol)')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) return { data: null, error: handleSupabaseError(error) }

    const report = (data ?? []).map(m => {
      const stock     = Number(m.current_stock)
      const costSyp   = Number(m.unit_cost_syp ?? 0)
      const costUsd   = Number(m.unit_cost_usd ?? 0)
      const minAlert  = m.min_stock_alert != null ? Number(m.min_stock_alert) : null

      return {
        id:              m.id,
        code:            m.code,
        name:            m.name,
        unit_name:       m.units?.name   ?? '—',
        unit_symbol:     m.units?.symbol ?? '—',
        current_stock:   stock,
        min_stock_alert: minAlert,
        unit_cost_syp:   costSyp,
        unit_cost_usd:   costUsd,
        total_value_syp: stock * costSyp,
        total_value_usd: stock * costUsd,
        stock_status:
          stock === 0          ? 'zero' :
          minAlert != null && stock <= minAlert ? 'low' : 'ok',
      }
    })

    return { data: report, error: null }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}

// ══════════════════════════════════════════════════════════════
// 📈 تقرير الحركات (مع رسم بياني)
// ══════════════════════════════════════════════════════════════

/**
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo   - YYYY-MM-DD
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function getMovementsReport(dateFrom, dateTo) {
  const from = cleanDate(dateFrom)
  const to   = cleanDate(dateTo)
  if (!from || !to) return { data: null, error: 'نطاق التاريخ غير صحيح' }

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('transaction_type, quantity, unit_cost_syp, created_at, material_id, materials(name)')
      .gte('created_at', `${from}T00:00:00.000Z`)
      .lte('created_at', `${to}T23:59:59.999Z`)

    if (error) return { data: null, error: handleSupabaseError(error) }

    const txList = data ?? []

    // تجميع يومي للرسم البياني
    const byDay = {}
    txList.forEach(tx => {
      const date = tx.created_at.split('T')[0]
      if (!byDay[date]) byDay[date] = { date, in: 0, out: 0 }
      const dir = TRANSACTION_TYPES[tx.transaction_type]?.direction ?? 0
      if (dir === +1) byDay[date].in  += Number(tx.quantity)
      else            byDay[date].out += Number(tx.quantity)
    })

    const chartData = Object.values(byDay)
      .sort((a, b) => a.date.localeCompare(b.date))

    // أكثر المواد نشاطاً
    const byMaterial = {}
    txList.forEach(tx => {
      const id = tx.material_id
      if (!byMaterial[id]) byMaterial[id] = {
        id, name: tx.materials?.name ?? '—',
        count: 0, in_qty: 0, out_qty: 0,
      }
      byMaterial[id].count++
      const dir = TRANSACTION_TYPES[tx.transaction_type]?.direction ?? 0
      if (dir === +1) byMaterial[id].in_qty  += Number(tx.quantity)
      else            byMaterial[id].out_qty += Number(tx.quantity)
    })

    const topMaterials = Object.values(byMaterial)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // إحصائيات بالنوع
    const byType = {}
    txList.forEach(tx => {
      byType[tx.transaction_type] = (byType[tx.transaction_type] ?? 0) + 1
    })

    return {
      data: {
        total:        txList.length,
        chart_data:   chartData,
        top_materials: topMaterials,
        by_type:      byType,
      },
      error: null,
    }
  } catch (err) {
    return { data: null, error: handleSupabaseError(err) }
  }
}
