import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getOrderTabCounts, getOrders, type OrderFilter } from '@/lib/services/orders'
import { formatMoney } from '@/lib/constants'
import { getBusinessNow } from '@/lib/time'
import { isMonthKey, monthRange, shiftMonth } from '@/lib/calc/sales'
import { groupOrdersByDue, type DueGroupKey } from '@/lib/order-groups'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LinkButton } from '@/components/ui/LinkButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { OrderListCard } from '@/components/orders/OrderListCard'

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/** /orders?status=…&month=… keeping the choices that matter (and short when they're the defaults). */
function ordersHref(status: OrderFilter, month?: string) {
  const params = new URLSearchParams()
  if (status !== 'active') params.set('status', status)
  if (month) params.set('month', month)
  const qs = params.toString()
  return qs ? `/orders?${qs}` : '/orders'
}

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

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string; month?: string } }) {
  const { business, settings } = await getCurrentBusinessContext()
  const filter = FILTERS.find((f) => f.key === searchParams.status)?.key ?? 'active'
  const today = getBusinessNow(settings.timezone).isoDate
  const thisMonth = today.slice(0, 7)

  // ?month=YYYY-MM picks a month; ?month=all shows everything. With no choice,
  // Active shows all upcoming orders and the history tabs start on this month.
  const month: string | null =
    searchParams.month === 'all' ? null : isMonthKey(searchParams.month) ? searchParams.month : filter === 'active' ? null : thisMonth
  const range = month ? monthRange(month) : undefined

  const supabase = createClient()
  const [orders, counts] = await Promise.all([
    getOrders(supabase, business.id, filter, month ? 500 : 100, range),
    getOrderTabCounts(supabase, business.id, range).catch(() => null),
  ])
  // Active orders are grouped by when they're due; the other tabs stay a plain list (newest first).
  const groups = filter === 'active' ? groupOrdersByDue(orders, today) : null
  const money = (n: number) => formatMoney(n, settings.currency)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="Orders" subtitle="Everything customers have asked for" action={<LinkButton href="/orders/new">New order</LinkButton>} />

      <nav aria-label="Filter orders" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <Link
              key={f.key}
              href={ordersHref(f.key, searchParams.month)}
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

      {/* Month switcher: ‹ October 2026 ›  [All time] */}
      <div className="-mt-2 flex items-center gap-2 lg:max-w-xl">
        <div className="flex flex-1 items-center justify-between rounded-pill bg-base-card px-1 py-1 shadow-card">
          <Link
            href={ordersHref(filter, shiftMonth(month ?? thisMonth, -1))}
            scroll={false}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-pill text-lg text-ink hover:bg-ink/5"
          >
            ‹
          </Link>
          <span className={clsx('text-sm font-medium', month ? 'text-ink' : 'text-ink-muted')}>
            {month ? monthLabel(month) : 'All months'}
          </span>
          <Link
            href={ordersHref(filter, shiftMonth(month ?? thisMonth, 1))}
            scroll={false}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-pill text-lg text-ink hover:bg-ink/5"
          >
            ›
          </Link>
        </div>
        <Link
          href={month ? ordersHref(filter, 'all') : ordersHref(filter, thisMonth)}
          scroll={false}
          className={clsx(
            'shrink-0 rounded-pill px-4 py-2.5 text-sm font-medium shadow-card',
            month ? 'bg-base-card text-ink-muted' : 'bg-raspberry-soft text-raspberry-dark'
          )}
        >
          {month ? 'All time' : 'This month'}
        </Link>
      </div>

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
                <ul className="grid gap-3 lg:grid-cols-2">
                  {group.orders.map((order) => (
                    <OrderListCard key={order.id} order={order} group={group.key} money={money} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {orders.map((order) => (
            <OrderListCard key={order.id} order={order} group="all" money={money} />
          ))}
        </ul>
      )}
    </div>
  )
}
