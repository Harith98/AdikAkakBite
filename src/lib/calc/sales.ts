export interface OrderForSales {
  /** Day the order was completed, YYYY-MM-DD. */
  saleDate: string
  total: number
}

export interface SalesTotals {
  revenue: number
  orders: number
  averageOrderValue: number
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Spec §20-21. Takes already-completed orders (the caller filters by status
 * and date range) and totals them — deliberately trivial, so the interesting
 * logic (which orders count, what date range) stays in the service layer
 * where it can be tested against real query behaviour, not duplicated here.
 */
export function summarizeSales(orders: OrderForSales[]): SalesTotals {
  const revenue = round2(orders.reduce((sum, o) => sum + (Number.isFinite(o.total) ? o.total : 0), 0))
  const orderCount = orders.length
  return {
    revenue,
    orders: orderCount,
    averageOrderValue: orderCount > 0 ? round2(revenue / orderCount) : 0,
  }
}

// ---------------------------------------------------------------------------
// Monthly report
// ---------------------------------------------------------------------------

/** "2026-09" → first and last day of that month. */
export function monthRange(month: string): { start: string; end: string; days: number } {
  const [y, m] = month.split('-').map(Number)
  const days = new Date(Date.UTC(y ?? 0, m ?? 1, 0)).getUTCDate()
  return { start: `${month}-01`, end: `${month}-${String(days).padStart(2, '0')}`, days }
}

/** "2026-01" moved by -1 → "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

export function isMonthKey(value: string | undefined | null): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

/** Percentage change from `before` to `now`, or null when there's nothing to compare against. */
export function percentChange(now: number, before: number): number | null {
  if (!Number.isFinite(before) || before <= 0) return null
  return Math.round(((now - before) / before) * 1000) / 10
}

export interface CostPeriod {
  /** When this cost started (timestamp; only the date part is used). */
  effectiveFrom: string
  /** Cost of one unit: ingredients + packaging + other. */
  unitCost: number
}

/**
 * What one unit of a product cost to make on `saleDate`, from its cost history.
 * A cost of 0 counts as "not entered". When no cost had been entered by the
 * sale date (costs filled in after the sale), the first cost entered after it
 * is used instead. Null when the product has no cost at all.
 */
export function costOnDate(history: CostPeriod[], saleDate: string): number | null {
  const entered = history.filter((c) => Number.isFinite(c.unitCost) && c.unitCost > 0).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  if (entered.length === 0) return null
  const before = entered.filter((c) => c.effectiveFrom.slice(0, 10) <= saleDate)
  return (before[before.length - 1] ?? entered[0]!).unitCost
}

export interface MonthOrder {
  /** YYYY-MM-DD the order was completed. */
  saleDate: string
  total: number
  /** unitCost: what one unit cost to make (see costOnDate); null = no cost entered. */
  items: { name: string; quantity: number; amount: number; unitCost: number | null }[]
}

export interface MonthProfit {
  /** What the items sold cost to make (items with a cost only). */
  cost: number
  /** Revenue minus cost. */
  profit: number
  /** Profit as a % of revenue, one decimal; null with no revenue. */
  margin: number | null
  /** Items sold with no cost entered, so the profit above is too high by their cost. */
  missingCost: string[]
}

export interface MonthReport {
  totals: SalesTotals
  profit: MonthProfit
  /** One entry per day of the month, including days with no sales. */
  days: { date: string; revenue: number; orders: number }[]
  /** Best sellers by revenue (item amounts, before order-level discounts); profit null when a cost is missing. */
  topProducts: { name: string; quantity: number; revenue: number; profit: number | null }[]
  bestDay: { date: string; revenue: number } | null
}

export function buildMonthReport(orders: MonthOrder[], month: string, topCount = 5): MonthReport {
  const { days } = monthRange(month)
  const byDay = new Map<string, { revenue: number; orders: number }>()
  for (let d = 1; d <= days; d++) byDay.set(`${month}-${String(d).padStart(2, '0')}`, { revenue: 0, orders: 0 })

  const products = new Map<string, { name: string; quantity: number; revenue: number; cost: number; missing: boolean }>()
  let cost = 0
  const missingCost = new Map<string, string>()
  for (const order of orders) {
    const day = byDay.get(order.saleDate)
    if (day) {
      day.revenue = round2(day.revenue + (Number.isFinite(order.total) ? order.total : 0))
      day.orders++
    }
    for (const item of order.items) {
      const key = item.name.trim().toLowerCase()
      const entry = products.get(key) ?? { name: item.name.trim(), quantity: 0, revenue: 0, cost: 0, missing: false }
      entry.quantity += item.quantity
      entry.revenue = round2(entry.revenue + item.amount)
      if (item.unitCost === null) {
        entry.missing = true
        missingCost.set(key, item.name.trim())
      } else {
        const itemCost = item.unitCost * item.quantity
        entry.cost = round2(entry.cost + itemCost)
        cost = round2(cost + itemCost)
      }
      products.set(key, entry)
    }
  }
  const totals = summarizeSales(orders.map((o) => ({ saleDate: o.saleDate, total: o.total })))
  const profit = round2(totals.revenue - cost)

  const dayList = Array.from(byDay, ([date, v]) => ({ date, ...v }))
  const best = dayList.reduce<{ date: string; revenue: number } | null>(
    (top, d) => (d.revenue > 0 && (!top || d.revenue > top.revenue) ? { date: d.date, revenue: d.revenue } : top),
    null
  )
  return {
    totals,
    profit: {
      cost,
      profit,
      margin: totals.revenue > 0 ? Math.round((profit / totals.revenue) * 1000) / 10 : null,
      missingCost: Array.from(missingCost.values()).sort((a, b) => a.localeCompare(b)),
    },
    days: dayList,
    topProducts: Array.from(products.values())
      .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
      .slice(0, topCount)
      .map((p) => ({ name: p.name, quantity: p.quantity, revenue: p.revenue, profit: p.missing ? null : round2(p.revenue - p.cost) })),
    bestDay: best,
  }
}
