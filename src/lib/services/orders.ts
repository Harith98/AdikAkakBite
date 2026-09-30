import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/supabase/database.types'
import { calculateOrderTotals, type OrderTotals } from '@/lib/calc/orders'
import { groupBy, selectInChunks } from './db-helpers'

type Client = SupabaseClient<Database>
type OrderRow = Database['public']['Tables']['orders']['Row']

export interface OrderItemView {
  id: string
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
}

export interface OrderView extends OrderTotals {
  id: string
  customerId: string | null
  customerName: string | null
  orderDate: string
  requiredDate: string | null
  requiredTime: string | null
  status: OrderStatus
  paymentStatus: PaymentStatus
  items: OrderItemView[]
  notes: string | null
  customerPhone: string | null
  receiptNumber: number | null
  receiptIssuedAt: string | null
  paymentMethod: PaymentMethod | null
}

export type OrderFilter = 'active' | 'completed' | 'cancelled' | 'all'

const ACTIVE: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready']

/** Attach items, customer names and calculated totals to raw order rows. */
export async function hydrateOrders(supabase: Client, businessId: string, rows: OrderRow[]): Promise<OrderView[]> {
  if (rows.length === 0) return []
  const orderIds = rows.map((o) => o.id)
  const customerIds = Array.from(new Set(rows.map((o) => o.customer_id).filter((id): id is string => id !== null)))

  const [items, customers] = await Promise.all([
    selectInChunks(orderIds, (ids) => supabase.from('order_items').select('*').in('order_id', ids).order('created_at')),
    selectInChunks(customerIds, (ids) => supabase.from('customers').select('id, name, phone').eq('business_id', businessId).in('id', ids)),
  ])
  const customersById = new Map(customers.map((c) => [c.id, c]))
  const itemsByOrder = groupBy(items, (i) => i.order_id)

  return rows.map((o) => {
    const orderItems = itemsByOrder.get(o.id) ?? []
    const totals = calculateOrderTotals({
      items: orderItems.map((i) => ({ quantity: i.quantity, unitPrice: i.unit_price })),
      discount: o.discount,
      deliveryFee: o.delivery_fee,
      deposit: o.deposit,
    })
    return {
      ...totals,
      id: o.id,
      customerId: o.customer_id,
      customerName: o.customer_id ? customersById.get(o.customer_id)?.name ?? null : null,
      customerPhone: o.customer_id ? customersById.get(o.customer_id)?.phone ?? null : null,
      orderDate: o.order_date,
      requiredDate: o.required_date,
      requiredTime: o.required_time,
      status: o.status,
      paymentStatus: o.payment_status,
      items: orderItems.map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
      })),
      notes: o.notes,
      receiptNumber: o.receipt_number,
      receiptIssuedAt: o.receipt_issued_at,
      paymentMethod: o.payment_method,
    }
  })
}

export async function getOrders(
  supabase: Client,
  businessId: string,
  filter: OrderFilter,
  limit = 100
): Promise<OrderView[]> {
  let query = supabase.from('orders').select('*').eq('business_id', businessId)
  if (filter === 'active') query = query.in('status', ACTIVE)
  if (filter === 'completed') query = query.eq('status', 'completed')
  if (filter === 'cancelled') query = query.eq('status', 'cancelled')

  query =
    filter === 'active'
      ? query.order('required_date', { ascending: true, nullsFirst: false }).order('required_time', { ascending: true, nullsFirst: false })
      : query.order('order_date', { ascending: false }).order('created_at', { ascending: false })

  const { data, error } = await query.limit(limit)
  if (error) throw new Error(`Could not load orders: ${error.message}`)
  return hydrateOrders(supabase, businessId, data ?? [])
}

export async function getOrder(supabase: Client, businessId: string, orderId: string): Promise<OrderView | null> {
  const { data, error } = await supabase.from('orders').select('*').eq('business_id', businessId).eq('id', orderId).maybeSingle()
  if (error) throw new Error(`Could not load the order: ${error.message}`)
  if (!data) return null
  const [view] = await hydrateOrders(supabase, businessId, [data])
  return view ?? null
}

/** Completed orders in a date range, for sales summaries (spec §20-21). */
export async function getCompletedOrdersInRange(
  supabase: Client,
  businessId: string,
  startDate: string,
  endDate: string
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .gte('order_date', startDate)
    .lte('order_date', endDate)
  if (error) throw new Error(`Could not load orders: ${error.message}`)
  return data ?? []
}
