import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, OrderStatus } from '@/lib/supabase/database.types'
import { calculateOrderTotals } from '@/lib/calc/orders'
import { computeCustomerMetrics, type CustomerOrderInput } from '@/lib/calc/customers'
import { isWalkInName, normalizePhone, resolveCustomer, type CustomerCandidate } from '@/lib/customer-identity'
import { escapeLike, groupBy } from './db-helpers'
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
  // Old "Walk-in" records (from before walk-ins were saved without a customer)
  // aren't a real person, so they'd skew repeat-customer figures.
  const customers = (customersRes.data ?? []).filter((c) => customerId || !isWalkInName(c.name))
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

export type CustomerResolution = { ok: true; customerId: string | null } | { ok: false; error: string }

/**
 * Find (or create) the customer an order belongs to, using the phone-first
 * rules in resolveCustomer(). Returns customerId null for anonymous walk-ins.
 */
export async function findOrCreateCustomer(
  supabase: Client,
  businessId: string,
  name: string,
  phone: string | null
): Promise<CustomerResolution> {
  const phoneKey = normalizePhone(phone)
  // Two small indexed lookups in parallel: everyone with this number, and
  // everyone with this exact name (case-insensitive, wildcards escaped).
  const [byPhone, byName] = await Promise.all([
    phoneKey
      ? supabase.from('customers').select('id, name, phone').eq('business_id', businessId).eq('phone_key', phoneKey).limit(5)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('customers').select('id, name, phone').eq('business_id', businessId).ilike('name', escapeLike(name)).limit(20),
  ])
  if (byPhone.error) return { ok: false, error: byPhone.error.message }
  if (byName.error) return { ok: false, error: byName.error.message }

  const candidates = new Map<string, CustomerCandidate>()
  for (const c of [...(byPhone.data ?? []), ...(byName.data ?? [])]) candidates.set(c.id, c)
  const match = resolveCustomer({ name, phone, candidates: Array.from(candidates.values()) })

  switch (match.kind) {
    case 'anonymous':
      return { ok: true, customerId: null }
    case 'ambiguous':
      return {
        ok: false,
        error: `You have ${match.count} customers called "${name}". Add their phone number so the order goes to the right one.`,
      }
    case 'existing':
      if (match.setPhone && phone) {
        const { error } = await supabase.from('customers').update({ phone }).eq('id', match.id).eq('business_id', businessId)
        if (error) return { ok: false, error: error.message }
      }
      return { ok: true, customerId: match.id }
    case 'new': {
      const id = crypto.randomUUID()
      const { error } = await supabase.from('customers').insert({ id, business_id: businessId, name, phone })
      if (error) return { ok: false, error: error.message }
      return { ok: true, customerId: id }
    }
  }
}
