'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { setOrderStatus } from '@/app/(app)/today/actions'
import type { OrderStatus } from '@/lib/supabase/database.types'

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'preparing', label: 'Start preparing' },
  confirmed: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready', label: 'Mark ready' },
  ready: { status: 'completed', label: 'Mark completed' },
}

export function OrderStatusControls({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = NEXT[status]
  const isClosed = status === 'completed' || status === 'cancelled'

  async function change(to: OrderStatus) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. This change can't be saved until your connection returns.")
      return
    }
    setError(null)
    setPending(true)
    try {
      const result = await setOrderStatus(orderId, to)
      if (result.error) setError(result.error)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {next && (
        <Button size="lg" disabled={pending} onClick={() => change(next.status)}>
          {next.label}
        </Button>
      )}
      {isClosed ? (
        <Button variant="secondary" disabled={pending} onClick={() => change('confirmed')}>
          Reopen order
        </Button>
      ) : (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (confirm('Cancel this order? You can reopen it later.')) void change('cancelled')
          }}
        >
          Cancel order
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-clay-dark">
          {error}
        </p>
      )}
    </div>
  )
}
