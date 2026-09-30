import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, OrderStatus } from '@/lib/supabase/database.types'
import { calculateOrderTotals } from '@/lib/calc/orders'
import { computeCustomerMetrics, type CustomerOrderInput } from '@/lib/calc/customers'
import { groupBy } from './db-helpers'
import type { CustomerMetrics } from './types'

type Client = SupabaseClient<Database>

export interface CustomerView extends CustomerMetrics {
  phone: string | null
  email: string | null
  notes: string | null
}

/**
 * Spec §32 getCustomerMetrics(). Metrics are derived from orders on every
 * call. At the scale of a small business this is comfortably fast; if a
 * business ever grows to tens of thousands of orders, this is the function to
 * move into a SQL view — its return shape would not change.
 */
export async function getCustomerMetrics(
  supabase: Client,
  businessId: string,
  today: string,
  /** Limit to one customer (e.g. the detail page) instead of loading everyone's orders. */
  customerId?: string
): Promise<CustomerView[]> {
  let customersQuery = supabase.from('customers').select('*').eq('business_id', businessId)
  let ordersQuery = supabase
    .from('orders')
    // Line items come back embedded, so totals need no second round trip.
    .select('id, customer_id, order_date, status, discount, delivery_fee, order_items(quantity, unit_price)')
    .eq('business_id', businessId)
  if (customerId) {
    customersQuery = customersQuery.eq('id', customerId)
    ordersQuery = ordersQuery.eq('customer_id', customerId)
  } else {
    ordersQuery = ordersQuery.not('customer_id', 'is', null)
  }

  const [customersRes, ordersRes] = await Promise.all([customersQuery.order('name', { ascending: true }), ordersQuery])
  if (customersRes.error) throw new Error(`Could not load customers: ${customersRes.error.message}`)
  if (ordersRes.error) throw new Error(`Could not load orders: ${ordersRes.error.message}`)
  const customers = customersRes.data ?? []
  const orders = (ordersRes.data ?? []) as unknown as {
    id: string
    customer_id: string | null
    order_date: string
    status: OrderStatus
    discount: number
    delivery_fee: number
    order_items: { quantity: number; unit_price: number }[] | null
  }[]

  // Totals are only needed for completed orders.
  const totalByOrder = new Map<string, number>()
  for (const order of orders) {
    if (order.status !== 'completed') continue
    const lines = (order.order_items ?? []).map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price }))
    totalByOrder.set(order.id, calculateOrderTotals({ items: lines, discount: order.discount, deliveryFee: order.delivery_fee }).total)
  }
  const ordersByCustomer = groupBy(orders, (o) => o.customer_id)

  return customers.map((customer) => {
    const customerOrders: CustomerOrderInput[] = (ordersByCustomer.get(customer.id) ?? [])
      .map((o) => ({ orderDate: o.order_date, status: o.status, total: totalByOrder.get(o.id) ?? 0 }))
    return {
      ...computeCustomerMetrics({ customerId: customer.id, name: customer.name, orders: customerOrders, today }),
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
    }
  })
}
