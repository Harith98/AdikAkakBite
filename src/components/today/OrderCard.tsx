import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatMoney } from '@/lib/constants'
import { formatDuration, formatTime12 } from '@/lib/time'
import type { OrderUrgency } from '@/lib/services/recommendation'
import type { TodayOrder } from '@/lib/services/today'
import { OrderActions } from './OrderActions'

const PAYMENT_LABEL = { unpaid: 'Unpaid', deposit_paid: 'Deposit paid', fully_paid: 'Fully paid' } as const

interface OrderCardProps {
  order: TodayOrder
  urgency: OrderUrgency
  today: string
  currency: string
}

export function OrderCard({ order, urgency, today, currency }: OrderCardProps) {
  const isLate = urgency.isOverdue
  const label = isLate
    ? '🔴 Overdue'
    : urgency.isUrgent
      ? '🔴 Due soon'
      : order.requiredDate === today
        ? '🟡 Due today'
        : 'Upcoming'

  const due = order.requiredDate && order.requiredDate < today
    ? `Was due ${order.requiredDate}`
    : order.requiredTime
      ? `Due ${formatTime12(order.requiredTime)}${
          urgency.minutesUntilDue !== null && urgency.minutesUntilDue >= 0
            ? ` · in ${formatDuration(urgency.minutesUntilDue)}`
            : ''
        }`
      : 'Due today · no time set'

  return (
    <Card className={urgency.isUrgent ? 'border-2 border-raspberry' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <Badge tone={urgency.isUrgent ? 'raspberry' : 'amber'}>{label}</Badge>
        <span className="text-xs text-ink-muted">{PAYMENT_LABEL[order.paymentStatus]}</span>
      </div>
      <p className="mt-3 font-display text-2xl text-ink">{order.customerName ?? 'Customer'}</p>
      {order.items.length > 0 ? (
        <ul className="mt-1 text-sm text-ink">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              {item.quantity} × {item.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">No items listed</p>
      )}
      <p className="mt-2 text-sm text-ink-muted">{due}</p>
      <p className="mt-1 text-sm font-medium text-ink">
        {formatMoney(order.total, currency)}
        {order.balance > 0 && order.balance !== order.total && (
          <span className="font-normal text-ink-muted"> · {formatMoney(order.balance, currency)} still to pay</span>
        )}
      </p>
      {order.notes && <p className="mt-2 text-sm text-ink-muted">{order.notes}</p>}
      <OrderActions orderId={order.id} status={order.status} />
    </Card>
  )
}
