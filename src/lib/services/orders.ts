import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, OrderStatus, PaymentMethod, PaymentStatus } from '@/lib/supabase/database.types'
import { calculateOrderTotals, type OrderTotals } from '@/lib/calc/orders'
import { one } from './db-helpers'

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

/**
 * Order + its items + its customer in ONE round trip (PostgREST embedding over
 * the order_items.order_id and orders.customer_id foreign keys), instead of
 * fetching the orders first and their children second.
 */
export const ORDER_SELECT = '*, order_items(*), customer:customers(name, phone)'

type ItemRow = Database['public']['Tables']['order_items']['Row']
export type OrderRowWithRelations = OrderRow & {
  order_items: ItemRow[] | null
  customer: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null
}

/** Turn embedded order rows into views with calculated totals. */
export function toOrderViews(rows: OrderRowWithRelations[]): OrderView[] {
  return rows.map((o) => {
    const orderItems = [...(o.order_items ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const customer = one(o.customer)
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
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
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
  let query = supabase.from('orders').select(ORDER_SELECT).eq('business_id', businessId)
  if (filter === 'active') query = query.in('status', ACTIVE)
  if (filter === 'completed') query = query.eq('status', 'completed')
  if (filter === 'cancelled') query = query.eq('status', 'cancelled')

  query =
    filter === 'active'
      ? query.order('required_date', { ascending: true, nullsFirst: false }).order('required_time', { ascending: true, nullsFirst: false })
      : query.order('order_date', { ascending: false }).order('created_at', { ascending: false })

  const { data, error } = await query.limit(limit)
  if (error) throw new Error(`Could not load orders: ${error.message}`)
  return toOrderViews((data ?? []) as unknown as OrderRowWithRelations[])
}

export async function getOrder(supabase: Client, businessId: string, orderId: string): Promise<OrderView | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('business_id', businessId)
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw new Error(`Could not load the order: ${error.message}`)
  if (!data) return null
  return toOrderViews([data as unknown as OrderRowWithRelations])[0] ?? null
}

export interface CompletedOrderForSales {
  id: string
  completed_on: string
  discount: number
  delivery_fee: number
  order_items: { quantity: number; unit_price: number }[] | null
}

/** Orders completed in a date range (by completion day, so advance orders count when fulfilled) with their line items, for sales summaries (spec §20-21). */
export async function getCompletedOrdersInRange(
  supabase: Client,
  businessId: string,
  startDate: string,
  endDate: string
): Promise<CompletedOrderForSales[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, completed_on, discount, delivery_fee, order_items(quantity, unit_price)')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .gte('completed_on', startDate)
    .lte('completed_on', endDate)
  if (error) throw new Error(`Could not load orders: ${error.message}`)
  return (data ?? []) as unknown as CompletedOrderForSales[]
}
