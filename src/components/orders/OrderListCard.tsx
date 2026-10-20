import Link from 'next/link'
import clsx from '@/lib/clsx'
import { formatReceiptNumber } from '@/lib/receipts'
import { formatTime12 } from '@/lib/time'
import type { DueGroupKey } from '@/lib/order-groups'
import type { OrderView } from '@/lib/services/orders'
import type { OrderStatus } from '@/lib/supabase/database.types'
import { Avatar } from '@/components/ui/Avatar'

/** Status → stripe colour and label. */
const STATUS: Record<OrderStatus, { label: string; stripe: string; dot: string }> = {
  new: { label: 'New', stripe: 'bg-raspberry', dot: 'bg-raspberry' },
  confirmed: { label: 'Confirmed', stripe: 'bg-amber', dot: 'bg-amber' },
  preparing: { label: 'Preparing', stripe: 'bg-raspberry-dark', dot: 'bg-raspberry-dark' },
  ready: { label: 'Ready', stripe: 'bg-sage', dot: 'bg-sage-dark' },
  completed: { label: 'Completed', stripe: 'bg-sage-dark', dot: 'bg-sage-dark' },
  cancelled: { label: 'Cancelled', stripe: 'bg-ink-faint', dot: 'bg-ink-faint' },
}

/** Calendar tile colour by how soon it's due. */
const TILE: Record<DueGroupKey | 'all', string> = {
  overdue: 'bg-clay text-white',
  today: 'bg-raspberry text-white',
  tomorrow: 'bg-amber-soft text-amber-dark',
  this_week: 'bg-sage-soft text-sage-dark',
  next_week: 'bg-base-soft text-ink',
  later: 'bg-base-soft text-ink',
  no_date: 'bg-base-soft text-ink-muted',
  all: 'bg-base-soft text-ink',
}

function calendarParts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`)
  return {
    weekday: d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short' }).toUpperCase(),
    day: d.getUTCDate(),
    month: d.toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short' }).toUpperCase(),
  }
}

interface Props {
  order: OrderView
  /** Which due group it's in (colours the date tile); 'all' outside the Active tab. */
  group: DueGroupKey | 'all'
  money: (n: number) => string
}

/** One order in the Orders list: status stripe, date tile, customer, items, time, and what's still owed. */
export function OrderListCard({ order, group, money }: Props) {
  const status = STATUS[order.status]
  const cal = order.requiredDate ? calendarParts(order.requiredDate) : null
  const name = order.customerName ?? 'Walk-in'
  const items = order.items.map((i) => `${i.quantity}× ${i.productName}`)
  const finished = order.status === 'completed' || order.status === 'cancelled'

  return (
    <li>
      <Link
        href={`/orders/${order.id}`}
        className={clsx(
          'relative flex gap-3 overflow-hidden rounded-card border border-raspberry/15 bg-base-card py-3 pl-4 pr-4 shadow-card transition-transform active:scale-[0.99]',
          order.status === 'cancelled' && 'opacity-60'
        )}
      >
        <span aria-hidden="true" className={clsx('absolute inset-y-0 left-0 w-1.5', status.stripe)} />

        {cal ? (
          <span className={clsx('flex w-14 shrink-0 flex-col items-center justify-center rounded-card py-1.5 leading-none', TILE[group])}>
            <span className="text-[10px] font-semibold tracking-wide opacity-80">{cal.weekday}</span>
            <span className="my-0.5 font-display text-2xl">{cal.day}</span>
            <span className="text-[10px] font-semibold tracking-wide opacity-80">{cal.month}</span>
          </span>
        ) : (
          <span className="flex w-14 shrink-0 flex-col items-center justify-center rounded-card bg-base-soft text-center text-[10px] font-medium leading-tight text-ink-muted">
            No
            <br />
            date
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <Avatar url={null} name={name} size={22} className="!text-[10px]" />
            <span className="truncate font-display text-lg leading-tight text-ink">{name}</span>
          </span>
          <span className="mt-1 line-clamp-2 block text-sm text-ink-muted">{items.length > 0 ? items.join(', ') : 'No items'}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span aria-hidden="true" className={clsx('h-2 w-2 rounded-full', status.dot)} />
              {status.label}
            </span>
            {order.requiredTime && <span className="text-ink-muted">⏰ {formatTime12(order.requiredTime)}</span>}
            {order.receiptNumber !== null && <span className="text-ink-muted">🧾 {formatReceiptNumber(order.receiptNumber)}</span>}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end justify-between text-right">
          <span className="font-display text-lg leading-tight text-ink">{money(order.total)}</span>
          {order.paymentStatus === 'fully_paid' ? (
            <span className="rounded-pill bg-sage-soft px-2 py-0.5 text-[11px] font-medium text-sage-dark">✓ Paid</span>
          ) : order.balance > 0 && !finished ? (
            <span className="rounded-pill bg-clay-soft px-2 py-0.5 text-[11px] font-medium text-clay-dark">
              {money(order.balance)} due
            </span>
          ) : order.paymentStatus === 'deposit_paid' ? (
            <span className="rounded-pill bg-amber-soft px-2 py-0.5 text-[11px] font-medium text-amber-dark">Deposit</span>
          ) : null}
        </span>
      </Link>
    </li>
  )
}
