import type { OrderStatus } from '@/lib/supabase/database.types'
import { daysBetweenISO } from '@/lib/time'
import type { CustomerMetrics } from '@/lib/services/types'

export interface CustomerOrderInput {
  /** YYYY-MM-DD */
  orderDate: string
  status: OrderStatus
  /** Order total (items − discount + delivery fee). */
  total: number
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Spec §14, computed from orders — never stored, so it can't drift.
 *  - Only COMPLETED orders count as purchases; cancelled orders are ignored;
 *    orders still in progress are reported separately as `openOrders`.
 *  - lifetime value / total spending = sum of completed order totals
 *  - repeat customer = more than one completed order
 *  - days since last order = today − last completed order date
 *  - purchases per month = completed orders ÷ active period, where the active
 *    period runs from the first completed order to today, with a minimum of one month.
 */
export function computeCustomerMetrics(input: {
  customerId: string
  name: string
  orders: CustomerOrderInput[]
  today: string
}): CustomerMetrics {
  const completed = input.orders.filter((o) => o.status === 'completed')
  const openOrders = input.orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length

  if (completed.length === 0) {
    return {
      customerId: input.customerId,
      name: input.name,
      firstOrderDate: null,
      lastOrderDate: null,
      numberOfOrders: 0,
      totalSpending: 0,
      isRepeatCustomer: false,
      daysSinceLastOrder: null,
      purchasesPerMonth: null,
      openOrders,
    }
  }

  const dates = completed.map((o) => o.orderDate).sort()
  const first = dates[0] as string
  const last = dates[dates.length - 1] as string
  const activeMonths = Math.max(daysBetweenISO(first, input.today) / 30, 1)

  return {
    customerId: input.customerId,
    name: input.name,
    firstOrderDate: first,
    lastOrderDate: last,
    numberOfOrders: completed.length,
    totalSpending: round2(completed.reduce((sum, o) => sum + (Number.isFinite(o.total) ? o.total : 0), 0)),
    isRepeatCustomer: completed.length > 1,
    daysSinceLastOrder: Math.max(daysBetweenISO(last, input.today), 0),
    purchasesPerMonth: round2(completed.length / activeMonths),
    openOrders,
  }
}
