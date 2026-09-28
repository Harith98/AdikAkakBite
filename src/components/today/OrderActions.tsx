'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { setOrderStatus } from '@/app/(app)/today/actions'
import type { OrderStatus } from '@/lib/supabase/database.types'

const NEXT_STEP: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: 'preparing', label: 'Start preparing' },
  confirmed: { status: 'preparing', label: 'Start preparing' },
  preparing: { status: 'ready', label: 'Mark ready' },
  ready: { status: 'completed', label: 'Mark completed' },
}

export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const step = NEXT_STEP[status]

  async function advance() {
    if (!step) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. This change can't be saved until your connection returns.")
      return
    }
    setError(null)
    setPending(true)
    try {
      const result = await setOrderStatus(orderId, step.status)
      if (result.error) setError(result.error)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {step && (
          <Button className="flex-1" size="lg" disabled={pending} onClick={advance}>
            {step.label}
          </Button>
        )}
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex h-14 items-center justify-center rounded-pill border border-ink/10 bg-base-soft px-5 text-sm font-medium text-ink"
        >
          View order
        </Link>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-clay-dark">
          {error}
        </p>
      )}
    </div>
  )
}
