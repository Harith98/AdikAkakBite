import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getOrderTabCounts, getOrders, type OrderFilter } from '@/lib/services/orders'
import { formatMoney } from '@/lib/constants'
import { getBusinessNow } from '@/lib/time'
import { groupOrdersByDue, type DueGroupKey } from '@/lib/order-groups'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LinkButton } from '@/components/ui/LinkButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { OrderListCard } from '@/components/orders/OrderListCard'

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]

/** Heading icon and colour for each due group. */
const GROUP_STYLE: Record<DueGroupKey, { icon: string; className: string }> = {
  overdue: { icon: '⚠️', className: 'text-clay-dark' },
  today: { icon: '🔥', className: 'text-raspberry-dark' },
  tomorrow: { icon: '⏭️', className: 'text-amber-dark' },
  this_week: { icon: '📅', className: 'text-ink-muted' },
  next_week: { icon: '🗓️', className: 'text-ink-muted' },
  later: { icon: '🔭', className: 'text-ink-muted' },
  no_date: { icon: '❔', className: 'text-ink-muted' },
}

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const filter = FILTERS.find((f) => f.key === searchParams.status)?.key ?? 'active'
  const supabase = createClient()
  const [orders, counts] = await Promise.all([
    getOrders(supabase, business.id, filter),
    getOrderTabCounts(supabase, business.id).catch(() => null),
  ])
  const today = getBusinessNow(settings.timezone).isoDate
  // Active orders are grouped by when they're due; the other tabs stay a plain list (newest first).
  const groups = filter === 'active' ? groupOrdersByDue(orders, today) : null
  const money = (n: number) => formatMoney(n, settings.currency)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Orders" subtitle="Everything customers have asked for" action={<LinkButton href="/orders/new">New order</LinkButton>} />

      <nav aria-label="Filter orders" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <Link
              key={f.key}
              href={f.key === 'active' ? '/orders' : `/orders?status=${f.key}`}
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-2 text-sm font-medium transition-colors',
                on ? 'bg-raspberry text-white shadow-card' : 'bg-base-card text-ink-muted shadow-card hover:text-ink'
              )}
            >
              {f.label}
              {counts && <span className={clsx('rounded-pill px-1.5 text-xs', on ? 'bg-white/25' : 'bg-ink/5')}>{counts[f.key]}</span>}
            </Link>
          )
        })}
      </nav>

      {orders.length === 0 ? (
        <Card>
          {filter === 'active' ? (
            <EmptyState
              emoji="🧁"
              title="No active orders"
              text="New orders show up here. Paste one from WhatsApp, or share your menu to get some."
              action={{ href: '/orders/new', label: 'Add an order' }}
            />
          ) : (
            <EmptyState emoji="🗂️" title="Nothing here yet" text="Orders will appear here once they reach this stage." />
          )}
        </Card>
      ) : groups ? (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const style = GROUP_STYLE[group.key]
            return (
              <section key={group.key} aria-label={group.label}>
                <p className={clsx('mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide', style.className)}>
                  <span aria-hidden="true" className="text-sm">
                    {style.icon}
                  </span>
                  {group.label}
                  <span className="rounded-pill bg-ink/5 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-muted">
                    {group.orders.length}
                  </span>
                </p>
                <ul className="flex flex-col gap-3">
                  {group.orders.map((order) => (
                    <OrderListCard key={order.id} order={order} group={group.key} money={money} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <OrderListCard key={order.id} order={order} group="all" money={money} />
          ))}
        </ul>
      )}
    </div>
  )
}
