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
import { fetchAllPages } from '@/lib/services/db-helpers'
import { getSalesDetail, type SaleDetail } from '@/lib/services/sales'
import { financeByMonth, type FinanceRow } from '@/lib/calc/sales'
import { getExpenseEntries } from '@/lib/services/expenses'
import { expenseCategory, type ExpenseEntry } from '@/lib/expenses'

export const dynamic = 'force-dynamic'

/** Every row, page by page (see fetchAllPages). */
const fetchAll = fetchAllPages

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

const FINANCE_COLUMNS: CsvColumn<FinanceRow>[] = [
  { header: 'Month', value: (r) => r.month },
  { header: 'Orders', value: (r) => r.orders },
  { header: 'Item sales', value: (r) => r.itemSales },
  { header: 'Discounts', value: (r) => r.discounts },
  { header: 'Delivery fees', value: (r) => r.deliveryFees },
  { header: 'Sales (order totals)', value: (r) => r.sales },
  { header: 'Cost of products', value: (r) => r.cost },
  { header: 'Gross profit', value: (r) => r.grossProfit },
  { header: 'Margin %', value: (r) => r.margin },
  { header: 'Average order', value: (r) => r.averageOrder },
  { header: 'Units with no cost entered', value: (r) => r.unitsWithoutCost },
  { header: 'Overheads', value: (r) => r.overheads },
  { header: 'Net profit', value: (r) => r.netProfit },
]

/** One row per expense entry (a monthly one appears once per month), then a TOTAL row. */
type ExpenseRow = { entry?: ExpenseEntry; total?: { amount: number; count: number } }

const EXPENSE_COLUMNS: CsvColumn<ExpenseRow>[] = [
  { header: 'Date', value: (r) => r.entry?.date ?? (r.total ? 'TOTAL' : null) },
  { header: 'Type', value: (r) => (r.entry ? expenseCategory(r.entry.category).label : r.total ? `${r.total.count} expenses` : null) },
  { header: 'Amount', value: (r) => r.entry?.amount ?? r.total?.amount },
  { header: 'Note', value: (r) => r.entry?.note },
  { header: 'Repeats monthly', value: (r) => (r.entry ? r.entry.repeating : null) },
]

/** One row per item sold; order-level money only on the order's first row, so each column adds up. */
type DetailRow = {
  sale?: SaleDetail
  item?: SaleDetail['items'][number]
  first: boolean
  total?: { quantity: number; lineTotal: number; cost: number; discount: number; deliveryFee: number; orderTotal: number; orders: number }
}

const round2 = (n: number) => Math.round(n * 100) / 100

const DETAIL_COLUMNS: CsvColumn<DetailRow>[] = [
  { header: 'Sale date', value: (r) => r.sale?.saleDate ?? (r.total ? 'TOTAL' : null) },
  { header: 'Order ref', value: (r) => (r.sale ? r.sale.orderId.slice(0, 8).toUpperCase() : r.total ? `${r.total.orders} orders` : null) },
  { header: 'Receipt no.', value: (r) => (r.first && r.sale?.receiptNumber != null ? formatReceiptNumber(r.sale.receiptNumber) : null) },
  { header: 'Customer', value: (r) => (r.sale ? r.sale.customer ?? 'Walk-in' : null) },
  { header: 'Item', value: (r) => r.item?.name },
  { header: 'Qty', value: (r) => r.item?.quantity ?? r.total?.quantity },
  { header: 'Unit price', value: (r) => r.item?.unitPrice },
  { header: 'Line total', value: (r) => (r.item ? round2(r.item.quantity * r.item.unitPrice) : r.total?.lineTotal) },
  { header: 'Unit cost used', value: (r) => r.item?.unitCost },
  { header: 'Cost', value: (r) => (r.item ? (r.item.unitCost === null ? null : round2(r.item.unitCost * r.item.quantity)) : r.total?.cost) },
  { header: 'Discount', value: (r) => (r.first ? r.sale?.discount : r.total?.discount) },
  { header: 'Delivery fee', value: (r) => (r.first ? r.sale?.deliveryFee : r.total?.deliveryFee) },
  { header: 'Order total', value: (r) => (r.first ? r.sale?.total : r.total?.orderTotal) },
  { header: 'Note', value: (r) => (r.item && r.item.unitCost === null ? 'No cost entered for this product' : null) },
]

function detailRows(sales: SaleDetail[]): DetailRow[] {
  const rows: DetailRow[] = sales.flatMap((sale): DetailRow[] =>
    sale.items.length > 0 ? sale.items.map((item, i) => ({ sale, item, first: i === 0 })) : [{ sale, first: true }]
  )
  const total = { quantity: 0, lineTotal: 0, cost: 0, discount: 0, deliveryFee: 0, orderTotal: 0, orders: sales.length }
  for (const sale of sales) {
    total.discount += sale.discount
    total.deliveryFee += sale.deliveryFee
    total.orderTotal += sale.total
    for (const item of sale.items) {
      total.quantity += item.quantity
      total.lineTotal += item.quantity * item.unitPrice
      if (item.unitCost !== null) total.cost += item.unitCost * item.quantity
    }
  }
  for (const key of ['lineTotal', 'cost', 'discount', 'deliveryFee', 'orderTotal'] as const) total[key] = round2(total[key])
  return [...rows, { first: false, total }]
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** ?from=…&to=… (sale days, inclusive); this month so far when missing. */
function dateRange(request: NextRequest, today: string): { from: string; to: string } | null {
  const from = request.nextUrl.searchParams.get('from') || `${today.slice(0, 7)}-01`
  const to = request.nextUrl.searchParams.get('to') || today
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) return null
  return { from, to }
}

const KINDS = ['orders', 'customers', 'products', 'inventory', 'stock-history', 'finance-summary', 'sales-detail', 'expenses'] as const
const DATED: readonly string[] = ['finance-summary', 'sales-detail', 'expenses']
type Kind = (typeof KINDS)[number]

/** Settings → Export data: one CSV per kind, for owners and admins. */
export async function GET(request: NextRequest, { params }: { params: { kind: string } }) {
  if (!KINDS.includes(params.kind as Kind)) return NextResponse.json({ error: 'Unknown export' }, { status: 404 })
  const kind = params.kind as Kind

  const ctx = await getActionContext()
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: 401 })
  if (!canManageBusiness(ctx.role)) return NextResponse.json({ error: 'Only the owner or an admin can export data.' }, { status: 403 })
  const { supabase, businessId, timezone } = ctx
  const today = getBusinessNow(timezone).isoDate

  const range = DATED.includes(kind) ? dateRange(request, today) : null
  if (DATED.includes(kind) && !range) {
    return NextResponse.json({ error: 'Choose a valid date range (the From date can’t be after the To date).' }, { status: 400 })
  }

  try {
    let csv: string
    let filename = `adikakak-${kind}-${today}.csv`
    if (range) {
      // Overheads only up to today: a monthly one later this month isn't paid yet.
      const expenseTo = range.to < today ? range.to : today
      if (kind === 'expenses') {
        const entries = await getExpenseEntries(supabase, businessId, range.from, expenseTo)
        const total = { amount: Math.round(entries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100, count: entries.length }
        csv = toCsv(EXPENSE_COLUMNS, [...entries.map((entry) => ({ entry })), { total }])
      } else if (kind === 'finance-summary') {
        const [sales, entries] = await Promise.all([
          getSalesDetail(supabase, businessId, range.from, range.to),
          getExpenseEntries(supabase, businessId, range.from, expenseTo),
        ])
        csv = toCsv(FINANCE_COLUMNS, financeByMonth(sales, entries))
      } else {
        csv = toCsv(DETAIL_COLUMNS, detailRows(await getSalesDetail(supabase, businessId, range.from, range.to)))
      }
      filename = `adikakak-${kind}-${range.from}-to-${range.to}.csv`
    } else if (kind === 'orders') {
      const rows = await fetchAll<OrderRowWithRelations>((from, to) =>
        supabase.from('orders').select(ORDER_SELECT).eq('business_id', businessId).order('order_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(from, to)
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
        supabase.from('inventory_items').select('*').eq('business_id', businessId).order('name').order('id').range(from, to)
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
          .order('id')
          .range(from, to)
      )
      csv = toCsv(HISTORY_COLUMNS, rows)
    }

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error(`Export ${kind} failed:`, err)
    return NextResponse.json({ error: 'The export failed. Please try again.' }, { status: 500 })
  }
}
