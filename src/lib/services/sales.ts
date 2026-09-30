import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { calculateOrderTotals } from '@/lib/calc/orders'
import { summarizeSales, type SalesTotals } from '@/lib/calc/sales'
import { groupBy, selectInChunks } from './db-helpers'
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
  const items = await selectInChunks(
    orders.map((o) => o.id),
    (ids) => supabase.from('order_items').select('order_id, quantity, unit_price').in('order_id', ids)
  )
  const itemsByOrder = groupBy(items, (i) => i.order_id)

  const rows = orders.map((o) => ({
    orderDate: o.order_date,
    total: calculateOrderTotals({
      items: (itemsByOrder.get(o.id) ?? []).map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price })),
      discount: o.discount,
      deliveryFee: o.delivery_fee,
    }).total,
  }))
  const since = (start: string) => summarizeSales(rows.filter((r) => r.orderDate >= start))

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

export interface DailyCloseInput {
  reviewDate: string
  revenue: number
  ordersCount: number
  wasteValue: number
  notes: string | null
}

/** Upserts the day's closing record (spec §8 Closing block, §61). Revenue/orders are a snapshot for the record — the live dashboard above always recomputes from orders, never from this table. */
export async function saveDailyClose(supabase: Client, businessId: string, input: DailyCloseInput) {
  const { error } = await supabase.from('daily_reviews').upsert(
    {
      business_id: businessId,
      review_date: input.reviewDate,
      revenue: input.revenue,
      orders_count: input.ordersCount,
      waste_value: input.wasteValue,
      unfinished_tasks_note: input.notes,
    },
    { onConflict: 'business_id,review_date' }
  )
  if (error) throw new Error(`Could not save the daily close: ${error.message}`)
}

export async function getRecentCloses(supabase: Client, businessId: string, limit = 14) {
  const { data, error } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('business_id', businessId)
    .order('review_date', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Could not load past closes: ${error.message}`)
  return data ?? []
}
