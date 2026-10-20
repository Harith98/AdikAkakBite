import Link from 'next/link'
import { upcomingByDay } from '@/lib/order-groups'
import { formatTime12 } from '@/lib/time'
import type { OrderView } from '@/lib/services/orders'
import { Card } from '@/components/ui/Card'

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
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Coming up · next {days} days</p>
        {count > 0 && (
          <Link href="/orders" className="text-sm text-ink-muted">
            {count} order{count === 1 ? '' : 's'} →
          </Link>
        )}
      </div>

      {byDay.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Nothing booked for the next {days} days.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {byDay.map((day) => (
            <section key={day.date}>
              <p className="text-sm font-medium text-ink">
                {day.label} <span className="font-normal text-ink-muted">· {day.orders.length}</span>
              </p>
              <ul className="mt-1 flex flex-col">
                {day.orders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/orders/${order.id}`} className="flex items-baseline justify-between gap-3 py-1 text-sm">
                      <span className="min-w-0">
                        <span className="text-ink">{order.customerName ?? 'Walk-in'}</span>
                        <span className="text-ink-muted">
                          {order.requiredTime ? ` · ${formatTime12(order.requiredTime)}` : ''}
                          {order.items.length > 0
                            ? ` · ${order.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}`
                            : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-ink-muted">{money(order.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}
