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
