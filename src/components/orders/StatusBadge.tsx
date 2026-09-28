import { Badge } from '@/components/ui/Badge'
import type { OrderStatus, PaymentStatus } from '@/lib/supabase/database.types'

const ORDER: Record<OrderStatus, { label: string; tone: 'neutral' | 'amber' | 'raspberry' | 'sage' | 'clay' }> = {
  new: { label: 'New', tone: 'amber' },
  confirmed: { label: 'Confirmed', tone: 'amber' },
  preparing: { label: 'Preparing', tone: 'raspberry' },
  ready: { label: 'Ready', tone: 'sage' },
  completed: { label: 'Completed', tone: 'sage' },
  cancelled: { label: 'Cancelled', tone: 'clay' },
}

const PAYMENT: Record<PaymentStatus, { label: string; tone: 'neutral' | 'amber' | 'sage' }> = {
  unpaid: { label: 'Unpaid', tone: 'neutral' },
  deposit_paid: { label: 'Deposit paid', tone: 'amber' },
  fully_paid: { label: 'Fully paid', tone: 'sage' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}
