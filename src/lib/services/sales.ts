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
  type FinanceOrder,
  type MonthOrder,
  type MonthReport,
  type SalesTotals,
} from '@/lib/calc/sales'
import { getCompletedOrdersInRange } from './orders'
import { fetchAllPages } from './db-helpers'
import { getExpenseEntries } from './expenses'
import { summarizeExpenses } from '@/lib/expenses'
import type { ExpenseCategory } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

export interface SalesPeriod {
  label: 'Today' | 'This week'
  startDate: string
  endDate: string
  totals: SalesTotals
}

/**
 * Today and this week (Mon–Sun), computed live from completed orders — never
 * stored, so it can't drift. (The month is the monthly report below them.)
 * Discounts and delivery fees are already folded into each order's `total`
 * (calculateOrderTotals), so summing totals is correct without re-adding them.
 */
export async function getSalesSummary(supabase: Client, businessId: string, today: string): Promise<SalesPeriod[]> {
  const weekStart = mondayOf(today)
  const orders = await getCompletedOrdersInRange(supabase, businessId, weekStart, today)

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
  /** Rent, bills, petrol… paid in the month (up to today). */
  overheads: { total: number; byCategory: { category: ExpenseCategory; amount: number }[] }
  /** Gross profit − overheads. */
  netProfit: number
}

/** Everything the monthly report shows: the month, its daily breakdown, best sellers, and last month for comparison. */
export async function getMonthSalesReport(supabase: Client, businessId: string, month: string, today: string): Promise<MonthSalesReport> {
  const range = monthRange(month)
  const previousRange = monthRange(shiftMonth(month, -1))
  const [orders, previousOrders, closes, expenses] = await Promise.all([
    getCompletedOrdersInRange(supabase, businessId, range.start, range.end),
    getCompletedOrdersInRange(supabase, businessId, previousRange.start, previousRange.end),
    supabase
      .from('daily_reviews')
      .select('waste_value')
      .eq('business_id', businessId)
      .gte('review_date', range.start)
      .lte('review_date', range.end),
    // Up to today: a monthly cost due later this month isn't paid yet.
    getExpenseEntries(supabase, businessId, range.start, range.end < today ? range.end : today),
  ])

  // Cost history of every product sold this month, so each sale uses the cost it had then.
  const costs = await loadCostHistory(supabase, orders.flatMap((o) => (o.order_items ?? []).map((i) => i.product_id)))

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
  const overheads = summarizeExpenses(expenses)
  return {
    ...report,
    month,
    previous,
    wasteValue: Math.round(wasteValue * 100) / 100,
    overheads,
    netProfit: Math.round((report.profit.profit - overheads.total) * 100) / 100,
  }
}

/** Cost history (one entry per cost change) of the given products, for costOnDate(). */
async function loadCostHistory(supabase: Client, productIds: (string | null)[]): Promise<Map<string, CostPeriod[]>> {
  const ids = Array.from(new Set(productIds.filter((id): id is string => Boolean(id))))
  const costs = new Map<string, CostPeriod[]>()
  if (ids.length === 0) return costs
  // In groups of 100 products (keeps each request short), every cost row of each.
  const rows: { product_id: string; ingredient_cost: number; packaging_cost: number; other_cost: number; effective_from: string }[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100)
    const batch = await fetchAllPages<(typeof rows)[number]>((from, to) =>
      supabase
        .from('product_costs')
        .select('product_id, ingredient_cost, packaging_cost, other_cost, effective_from')
        .in('product_id', group)
        .order('id')
        .range(from, to)
    ).catch((e: Error) => {
      throw new Error(`Could not load product costs: ${e.message}`)
    })
    rows.push(...batch)
  }
  for (const c of rows) {
    const list = costs.get(c.product_id) ?? []
    list.push({ effectiveFrom: c.effective_from, unitCost: Number(c.ingredient_cost) + Number(c.packaging_cost) + Number(c.other_cost) })
    costs.set(c.product_id, list)
  }
  return costs
}

/** A sale for the finance export: the order, who bought it, and each item with the cost used. */
export interface SaleDetail extends FinanceOrder {
  orderId: string
  receiptNumber: number | null
  customer: string | null
  items: { name: string; quantity: number; unitPrice: number; unitCost: number | null }[]
}

interface SaleRow {
  id: string
  completed_on: string
  created_at: string
  discount: number
  delivery_fee: number
  receipt_number: number | null
  customer: { name: string } | { name: string }[] | null
  order_items: { product_id: string | null; product_name: string; quantity: number; unit_price: number }[] | null
}

/**
 * Every order completed between two dates (by sale day, inclusive), oldest
 * first, with each item priced at its cost on the sale day. Fetched 1000 at a
 * time, so a long range never silently stops at Supabase's row limit.
 */
export async function getSalesDetail(supabase: Client, businessId: string, from: string, to: string): Promise<SaleDetail[]> {
  const rows: SaleRow[] = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, completed_on, created_at, discount, delivery_fee, receipt_number, customer:customers(name), order_items(product_id, product_name, quantity, unit_price)')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('completed_on', from)
      .lte('completed_on', to)
      .order('completed_on', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id') // fully fixed order, so pages never skip or repeat a row
      .range(start, start + 999)
    if (error) throw new Error(`Could not load sales: ${error.message}`)
    const batch = (data ?? []) as unknown as SaleRow[]
    rows.push(...batch)
    if (batch.length < 1000) break
  }

  const costs = await loadCostHistory(supabase, rows.flatMap((o) => (o.order_items ?? []).map((i) => i.product_id)))
  return rows.map((o) => {
    const items = o.order_items ?? []
    const totals = calculateOrderTotals({
      items: items.map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price })),
      discount: o.discount,
      deliveryFee: o.delivery_fee,
    })
    const customer = Array.isArray(o.customer) ? o.customer[0] : o.customer
    return {
      orderId: o.id,
      saleDate: o.completed_on,
      receiptNumber: o.receipt_number,
      customer: customer?.name ?? null,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      items: items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        unitCost: i.product_id ? costOnDate(costs.get(i.product_id) ?? [], o.completed_on) : null,
      })),
    }
  })
}
