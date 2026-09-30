import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getOrders, type OrderFilter, type OrderView } from '@/lib/services/orders'
import { formatMoney } from '@/lib/constants'
import { formatDateShort, formatTime12 } from '@/lib/time'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/LinkButton'
import { OrderStatusBadge, PaymentBadge } from '@/components/orders/StatusBadge'

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const filter = FILTERS.find((f) => f.key === searchParams.status)?.key ?? 'active'
  const orders = await getOrders(createClient(), business.id, filter)

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-3xl text-ink">Orders</p>
          <p className="mt-1 text-sm text-ink-muted">Everything customers have asked for</p>
        </div>
        <LinkButton href="/orders/new">New order</LinkButton>
      </header>

      <nav aria-label="Filter orders" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'active' ? '/orders' : `/orders?status=${f.key}`}
            aria-current={filter === f.key ? 'page' : undefined}
            className={clsx(
              'rounded-pill px-4 py-2 text-sm font-medium',
              filter === f.key ? 'bg-raspberry-soft text-raspberry-dark' : 'bg-base-card text-ink-muted shadow-card'
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            {filter === 'active' ? 'No active orders right now.' : 'Nothing here yet.'}{' '}
            {filter === 'active' && <Link href="/orders/new" className="font-medium text-raspberry-dark">Add an order</Link>}
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order: OrderView) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="block">
                <Card className="transition-colors hover:bg-base-soft">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-xl text-ink">{order.customerName ?? 'Customer'}</p>
                    <p className="text-sm font-medium text-ink">{formatMoney(order.total, settings.currency)}</p>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {order.items.map((item: OrderView['items'][number]) => `${item.quantity} × ${item.productName}`).join(', ') || 'No items'}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {order.requiredDate
                      ? `Needed ${formatDateShort(order.requiredDate)}${order.requiredTime ? ` at ${formatTime12(order.requiredTime)}` : ''}`
                      : 'No date set'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentBadge status={order.paymentStatus} />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
