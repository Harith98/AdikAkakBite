import Link from 'next/link'
import { upcomingByDay } from '@/lib/order-groups'
import { daysBetweenISO, formatTime12 } from '@/lib/time'
import clsx from '@/lib/clsx'
import type { OrderView } from '@/lib/services/orders'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'

interface Props {
  orders: OrderView[]
  today: string
  money: (n: number) => string
  days?: number
}

/** Orders due in the next few days, by day, so a big advance order never sneaks up on the day itself. */
export function ComingUpCard({ orders, today, money, days = 7 }: Props) {
  const byDay = upcomingByDay(orders, today, days)
  const count = byDay.reduce((sum, d) => sum + d.orders.length, 0)

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel icon="📅">Coming up · next {days} days</SectionLabel>
        {count > 0 && (
          <Link href="/orders" className="text-sm text-ink-muted">
            {count} order{count === 1 ? '' : 's'} →
          </Link>
        )}
      </div>

      {byDay.length === 0 ? (
        <EmptyState
          compact
          emoji="☕"
          title="Nothing booked yet"
          text={`No orders in the next ${days} days. A good time to post and share your menu!`}
          action={{ href: '/content', label: 'Post today' }}
        />
      ) : (
        <div className="mt-3 flex flex-col divide-y divide-ink/5">
          {byDay.map((day) => {
            const d = new Date(`${day.date}T00:00:00Z`)
            const tomorrow = daysBetweenISO(today, day.date) === 1
            return (
              <section key={day.date} aria-label={day.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                {/* Date tile: tomorrow stands out, later days are calmer. */}
                <span
                  className={clsx(
                    'flex w-12 shrink-0 flex-col items-center justify-center self-start rounded-card py-1.5 leading-none',
                    tomorrow ? 'bg-amber-soft text-amber-dark' : 'bg-base-soft text-ink'
                  )}
                >
                  <span className="text-[10px] font-semibold tracking-wide opacity-80">
                    {tomorrow ? 'TMRW' : d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' }).toUpperCase()}
                  </span>
                  <span className="my-0.5 font-display text-xl">{d.getUTCDate()}</span>
                  <span className="text-[10px] font-semibold tracking-wide opacity-80">
                    {d.toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short' }).toUpperCase()}
                  </span>
                </span>

                <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {day.orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/orders/${order.id}`}
                        className="flex items-center gap-3 rounded-card bg-base-soft/60 px-3 py-2 transition-colors hover:bg-base-soft"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink">{order.customerName ?? 'Walk-in'}</span>
                            {order.requiredTime && (
                              <span className="shrink-0 rounded-pill bg-white px-1.5 py-0.5 text-[11px] text-ink-muted">
                                ⏰ {formatTime12(order.requiredTime)}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">
                            {order.items.length > 0 ? order.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ') : 'No items'}
                          </span>
                        </span>
                        <span className="shrink-0 font-display text-base text-ink">{money(order.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Card>
  )
}
