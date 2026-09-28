import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getCustomerMetrics, type CustomerView } from '@/lib/services/customers'
import { hydrateOrders } from '@/lib/services/orders'
import { formatMoney } from '@/lib/constants'
import { formatDateShort, getBusinessNow } from '@/lib/time'
import { UUID_PATTERN } from '@/lib/validation/common'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { CustomerForm } from '@/components/business/CustomerForm'
import { OrderStatusBadge } from '@/components/orders/StatusBadge'

export default async function CustomerPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()
  const { business, settings } = await getCurrentBusinessContext()
  const supabase = createClient()
  const today = getBusinessNow(settings.timezone).isoDate

  const [customers, ordersRes] = await Promise.all([
    getCustomerMetrics(supabase, business.id, today),
    supabase
      .from('orders')
      .select('*')
      .eq('business_id', business.id)
      .eq('customer_id', params.id)
      .order('order_date', { ascending: false })
      .limit(50),
  ])
  const customer = customers.find((c: CustomerView) => c.customerId === params.id)
  if (!customer) notFound()
  if (ordersRes.error) throw new Error(`Could not load orders: ${ordersRes.error.message}`)
  const orders = await hydrateOrders(supabase, business.id, ordersRes.data ?? [])
  const money = (n: number) => formatMoney(n, settings.currency)

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business/customers" className="text-sm text-ink-muted">← Customers</Link>
        <p className="mt-2 font-display text-3xl text-ink">{customer.name}</p>
        {customer.isRepeatCustomer && <div className="mt-2"><Badge tone="sage">Repeat customer</Badge></div>}
      </header>

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Metric label="Lifetime value" value={money(customer.totalSpending)} />
          <Metric label="Completed orders" value={String(customer.numberOfOrders)} />
          <Metric label="First order" value={customer.firstOrderDate ? formatDateShort(customer.firstOrderDate) : '—'} />
          <Metric label="Last order" value={customer.lastOrderDate ? formatDateShort(customer.lastOrderDate) : '—'} />
          <Metric label="Days since last order" value={customer.daysSinceLastOrder === null ? '—' : String(customer.daysSinceLastOrder)} />
          <Metric label="Orders per month" value={customer.purchasesPerMonth === null ? '—' : String(customer.purchasesPerMonth)} />
        </dl>
        <p className="mt-3 text-xs text-ink-muted">Only completed orders count. Cancelled orders are ignored.</p>
      </Card>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Orders</p>
        {orders.length === 0 ? (
          <p className="text-sm text-ink-muted">No orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    <span className="block text-ink">{formatDateShort(o.orderDate)} · {money(o.total)}</span>
                    <span className="block text-ink-muted">{o.items.map((i) => `${i.quantity} × ${i.productName}`).join(', ')}</span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Details</p>
        <CustomerForm customer={{ id: customer.customerId, name: customer.name, phone: customer.phone, email: customer.email, notes: customer.notes }} />
      </Card>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}
