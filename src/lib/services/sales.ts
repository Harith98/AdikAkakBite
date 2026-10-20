import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { calculateOrderTotals } from '@/lib/calc/orders'
import {
  buildMonthReport,
  costOnDate,
  monthRange,
  shiftMonth,
  summarizeSales,
  type CostPeriod,
  type MonthOrder,
  type MonthReport,
  type SalesTotals,
} from '@/lib/calc/sales'
import { getCompletedOrdersInRange } from './orders'

type Client = SupabaseClient<Database>

export interface SalesPeriod {
  label: 'Today' | 'This week' | 'This month'
  startDate: string
  endDate: string
  totals: SalesTotals
}

/**
 * Today / this week (Mon–Sun) / this month, each computed live from
 * completed orders — never stored, so it can't drift (spec §21). Discounts
 * and delivery fees are already folded into each order's `total`
 * (calculateOrderTotals), so summing totals is correct without re-adding them.
 */
export async function getSalesSummary(supabase: Client, businessId: string, today: string): Promise<SalesPeriod[]> {
  const monthStart = `${today.slice(0, 7)}-01`
  const weekStart = mondayOf(today)
  // Early in a month the week began last month, so the week is NOT a subset of
  // the month. Fetch once from whichever starts first and split in memory.
  const rangeStart = weekStart < monthStart ? weekStart : monthStart

  const orders = await getCompletedOrdersInRange(supabase, businessId, rangeStart, today)

  const rows = orders.map((o) => ({
    saleDate: o.completed_on,
    total: calculateOrderTotals({
      items: (o.order_items ?? []).map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price })),
      discount: o.discount,
      deliveryFee: o.delivery_fee,
    }).total,
  }))
  const since = (start: string) => summarizeSales(rows.filter((r) => r.saleDate >= start))

  return [
    { label: 'Today', startDate: today, endDate: today, totals: since(today) },
    { label: 'This week', startDate: weekStart, endDate: today, totals: since(weekStart) },
    { label: 'This month', startDate: monthStart, endDate: today, totals: since(monthStart) },
  ]
}

/** Monday of the week containing `isoDate` (ISO weeks start Monday), as YYYY-MM-DD. */
function mondayOf(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1))
  const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay() // Sun=0 -> 7
  date.setUTCDate(date.getUTCDate() - (isoWeekday - 1))
  return date.toISOString().slice(0, 10)
}

export interface MonthSalesReport extends MonthReport {
  month: string
  previous: SalesTotals
  /** Waste recorded in daily closes during the month. */
  wasteValue: number
}

/** Everything the monthly report shows: the month, its daily breakdown, best sellers, and last month for comparison. */
export async function getMonthSalesReport(supabase: Client, businessId: string, month: string): Promise<MonthSalesReport> {
  const range = monthRange(month)
  const previousRange = monthRange(shiftMonth(month, -1))
  const [orders, previousOrders, closes] = await Promise.all([
    getCompletedOrdersInRange(supabase, businessId, range.start, range.end),
    getCompletedOrdersInRange(supabase, businessId, previousRange.start, previousRange.end),
    supabase
      .from('daily_reviews')
      .select('waste_value')
      .eq('business_id', businessId)
      .gte('review_date', range.start)
      .lte('review_date', range.end),
  ])

  // Cost history of every product sold this month, so each sale uses the cost it had then.
  const productIds = Array.from(new Set(orders.flatMap((o) => (o.order_items ?? []).map((i) => i.product_id)).filter((id): id is string => Boolean(id))))
  const costs = new Map<string, CostPeriod[]>()
  if (productIds.length > 0) {
    const { data, error } = await supabase
      .from('product_costs')
      .select('product_id, ingredient_cost, packaging_cost, other_cost, effective_from')
      .in('product_id', productIds)
    if (error) throw new Error(`Could not load product costs: ${error.message}`)
    for (const c of data ?? []) {
      const list = costs.get(c.product_id) ?? []
      list.push({ effectiveFrom: c.effective_from, unitCost: Number(c.ingredient_cost) + Number(c.packaging_cost) + Number(c.other_cost) })
      costs.set(c.product_id, list)
    }
  }

  const toMonthOrder = (o: (typeof orders)[number]): MonthOrder => {
    const items = o.order_items ?? []
    return {
      saleDate: o.completed_on,
      total: calculateOrderTotals({
        items: items.map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price })),
        discount: o.discount,
        deliveryFee: o.delivery_fee,
      }).total,
      items: items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        amount: i.quantity * i.unit_price,
        unitCost: i.product_id ? costOnDate(costs.get(i.product_id) ?? [], o.completed_on) : null,
      })),
    }
  }

  const report = buildMonthReport(orders.map(toMonthOrder), month)
  const previous = summarizeSales(previousOrders.map((o) => ({ saleDate: o.completed_on, total: toMonthOrder(o).total })))
  const wasteValue = (closes.data ?? []).reduce((sum, c) => sum + Number(c.waste_value ?? 0), 0)
  return { ...report, month, previous, wasteValue: Math.round(wasteValue * 100) / 100 }
}
