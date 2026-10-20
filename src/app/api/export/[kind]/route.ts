import { NextResponse, type NextRequest } from 'next/server'
import { getActionContext } from '@/lib/services/action-context'
import { ORDER_SELECT, toOrderViews, type OrderRowWithRelations, type OrderView } from '@/lib/services/orders'
import { getProducts, type ProductView } from '@/lib/services/products'
import { getCustomerMetrics, type CustomerView } from '@/lib/services/customers'
import { getInventoryStatus } from '@/lib/calc/inventory'
import { canManageBusiness } from '@/lib/team'
import { formatReceiptNumber } from '@/lib/receipts'
import { getBusinessNow } from '@/lib/time'
import { toCsv, type CsvColumn } from '@/lib/csv'

export const dynamic = 'force-dynamic'

const PAGE = 1000 // Supabase returns at most 1000 rows per request

/** Every row of a query, fetched 1000 at a time. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE) return rows
  }
}

type OrderLine = { order: OrderView; item: OrderView['items'][number] | null; first: boolean }

const ORDER_COLUMNS: CsvColumn<OrderLine>[] = [
  { header: 'Order ref', value: (r) => r.order.id.slice(0, 8).toUpperCase() },
  { header: 'Order date', value: (r) => r.order.orderDate },
  { header: 'Needed on', value: (r) => r.order.requiredDate },
  { header: 'Needed at', value: (r) => r.order.requiredTime?.slice(0, 5) },
  { header: 'Completed on', value: (r) => r.order.completedOn },
  { header: 'Status', value: (r) => r.order.status },
  { header: 'Payment', value: (r) => r.order.paymentStatus },
  { header: 'Customer', value: (r) => r.order.customerName ?? 'Walk-in' },
  { header: 'Phone', value: (r) => r.order.customerPhone },
  { header: 'Item', value: (r) => r.item?.productName },
  { header: 'Qty', value: (r) => r.item?.quantity },
  { header: 'Unit price', value: (r) => r.item?.unitPrice },
  { header: 'Line total', value: (r) => (r.item ? Math.round(r.item.quantity * r.item.unitPrice * 100) / 100 : null) },
  // Order-level money only on its first line, so summing a column doesn't double count.
  { header: 'Discount', value: (r) => (r.first ? r.order.discount : null) },
  { header: 'Delivery fee', value: (r) => (r.first ? r.order.deliveryFee : null) },
  { header: 'Order total', value: (r) => (r.first ? r.order.total : null) },
  { header: 'Paid', value: (r) => (r.first ? r.order.deposit : null) },
  { header: 'Balance', value: (r) => (r.first ? r.order.balance : null) },
  { header: 'Receipt no.', value: (r) => (r.first && r.order.receiptNumber !== null ? formatReceiptNumber(r.order.receiptNumber) : null) },
  { header: 'Notes', value: (r) => (r.first ? r.order.notes : null) },
]

const CUSTOMER_COLUMNS: CsvColumn<CustomerView>[] = [
  { header: 'Name', value: (c) => c.name },
  { header: 'Phone', value: (c) => c.phone },
  { header: 'Email', value: (c) => c.email },
  { header: 'Completed orders', value: (c) => c.numberOfOrders },
  { header: 'Open orders', value: (c) => c.openOrders },
  { header: 'Total spending', value: (c) => c.totalSpending },
  { header: 'First order', value: (c) => c.firstOrderDate },
  { header: 'Last order', value: (c) => c.lastOrderDate },
  { header: 'Days since last order', value: (c) => c.daysSinceLastOrder },
  { header: 'Repeat customer', value: (c) => c.isRepeatCustomer },
  { header: 'Notes', value: (c) => c.notes },
]

const PRODUCT_COLUMNS: CsvColumn<ProductView>[] = [
  { header: 'Name', value: (p) => p.name },
  { header: 'Category', value: (p) => p.category },
  { header: 'Selling price', value: (p) => p.sellingPrice },
  { header: 'Ingredient cost', value: (p) => p.ingredientCost },
  { header: 'Packaging cost', value: (p) => p.packagingCost },
  { header: 'Other cost', value: (p) => p.otherCost },
  { header: 'Total cost', value: (p) => p.totalCost },
  { header: 'Gross profit', value: (p) => p.grossProfit },
  { header: 'Margin %', value: (p) => (p.grossMargin === null ? null : Math.round(p.grossMargin * 10) / 10) },
  { header: 'Ready stock', value: (p) => p.readyStock },
  { header: 'Active', value: (p) => p.isActive },
  { header: 'Nicknames', value: (p) => p.nicknames.join('; ') },
  { header: 'Description', value: (p) => p.description },
  { header: 'Photo', value: (p) => p.imageUrl },
]

type ItemRow = {
  name: string
  category: string | null
  current_quantity: number
  unit: string
  reorder_level: number
  unit_cost: number
  supplier: string | null
  expiry_date: string | null
  notes: string | null
}

const INVENTORY_COLUMNS: CsvColumn<ItemRow>[] = [
  { header: 'Item', value: (i) => i.name },
  { header: 'Category', value: (i) => i.category },
  { header: 'In stock', value: (i) => Number(i.current_quantity) },
  { header: 'Unit', value: (i) => i.unit },
  { header: 'Reorder at', value: (i) => Number(i.reorder_level) },
  { header: 'Status', value: (i) => getInventoryStatus(Number(i.current_quantity), Number(i.reorder_level)).replace(/_/g, ' ') },
  { header: 'Cost per unit', value: (i) => Number(i.unit_cost) },
  { header: 'Stock value', value: (i) => Math.round(Number(i.current_quantity) * Number(i.unit_cost) * 100) / 100 },
  { header: 'Supplier', value: (i) => i.supplier },
  { header: 'Expiry', value: (i) => i.expiry_date },
  { header: 'Notes', value: (i) => i.notes },
]

type TransactionRow = {
  transaction_date: string
  transaction_type: string
  quantity: number
  unit: string
  reference: string | null
  notes: string | null
  item: { name: string } | { name: string }[] | null
}

const HISTORY_COLUMNS: CsvColumn<TransactionRow>[] = [
  { header: 'Date', value: (t) => t.transaction_date },
  { header: 'Item', value: (t) => (Array.isArray(t.item) ? t.item[0]?.name : t.item?.name) },
  { header: 'Type', value: (t) => t.transaction_type },
  { header: 'Quantity', value: (t) => Number(t.quantity) },
  { header: 'Unit', value: (t) => t.unit },
  { header: 'Reference', value: (t) => t.reference },
  { header: 'Notes', value: (t) => t.notes },
]

const KINDS = ['orders', 'customers', 'products', 'inventory', 'stock-history'] as const
type Kind = (typeof KINDS)[number]

/** Settings → Export data: one CSV per kind, for owners and admins. */
export async function GET(_request: NextRequest, { params }: { params: { kind: string } }) {
  if (!KINDS.includes(params.kind as Kind)) return NextResponse.json({ error: 'Unknown export' }, { status: 404 })
  const kind = params.kind as Kind

  const ctx = await getActionContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: 401 })
  if (!canManageBusiness(ctx.role)) return NextResponse.json({ error: 'Only the owner or an admin can export data.' }, { status: 403 })
  const { supabase, businessId, timezone } = ctx
  const today = getBusinessNow(timezone).isoDate

  try {
    let csv: string
    if (kind === 'orders') {
      const rows = await fetchAll<OrderRowWithRelations>((from, to) =>
        supabase.from('orders').select(ORDER_SELECT).eq('business_id', businessId).order('order_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
      )
      const lines = toOrderViews(rows).flatMap((order): OrderLine[] =>
        order.items.length > 0 ? order.items.map((item, i) => ({ order, item, first: i === 0 })) : [{ order, item: null, first: true }]
      )
      csv = toCsv(ORDER_COLUMNS, lines)
    } else if (kind === 'customers') {
      csv = toCsv(CUSTOMER_COLUMNS, await getCustomerMetrics(supabase, businessId, today))
    } else if (kind === 'products') {
      csv = toCsv(PRODUCT_COLUMNS, await getProducts(supabase, businessId))
    } else if (kind === 'inventory') {
      const rows = await fetchAll<ItemRow>((from, to) =>
        supabase.from('inventory_items').select('*').eq('business_id', businessId).order('name').range(from, to)
      )
      csv = toCsv(INVENTORY_COLUMNS, rows)
    } else {
      const rows = await fetchAll<TransactionRow>((from, to) =>
        supabase
          .from('inventory_transactions')
          .select('transaction_date, transaction_type, quantity, unit, reference, notes, item:inventory_items(name)')
          .eq('business_id', businessId)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, to)
      )
      csv = toCsv(HISTORY_COLUMNS, rows)
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="adikakak-${kind}-${today}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error(`Export ${kind} failed:`, err)
    return NextResponse.json({ error: 'The export failed. Please try again.' }, { status: 500 })
  }
}
