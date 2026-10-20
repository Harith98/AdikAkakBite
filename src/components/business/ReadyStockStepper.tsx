'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from '@/lib/clsx'
import { changeReadyStock } from '@/app/(app)/business/products/actions'

interface Props {
  productId: string
  productName: string
  initialStock: number
}

/**
 * − count + for one product's ready stock, right in the list.
 *   +  = one more made (same as "Add batch" of 1: uses the recipe's ingredients)
 *   −  = one gone without a sale (eaten, given away); ingredients untouched
 * The number changes on tap and saves in the background; a failed save is undone.
 */
export function ReadyStockStepper({ productId, productName, initialStock }: Props) {
  const router = useRouter()
  const [stock, setStock] = useState(initialStock)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(0)

  async function step(change: 'add' | 'remove') {
    if (change === 'remove' && stock <= 0) return
    setError(null)
    setStock((s) => s + (change === 'add' ? 1 : -1))
    pending.current++
    const result = await changeReadyStock(productId, change, 1).catch(() => ({ error: 'Couldn’t save. Check your connection.' }))
    pending.current--
    if (result.error) {
      setStock((s) => s - (change === 'add' ? 1 : -1))
      setError(result.error)
      return
    }
    // Refresh totals and order once the taps have settled.
    if (pending.current === 0) router.refresh()
  }

  const button =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border text-lg font-medium leading-none transition-colors active:scale-95 disabled:opacity-30'

  return (
    <div className="flex shrink-0 flex-col items-end">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => step('remove')}
          disabled={stock <= 0}
          aria-label={`One less ${productName} (eaten or given away)`}
          className={clsx(button, 'border-ink/15 bg-base-card text-ink-muted')}
        >
          −
        </button>
        <span
          aria-live="polite"
          aria-label={`${stock} ${productName} ready`}
          className={clsx('w-8 text-center font-display text-2xl tabular-nums', stock > 0 ? 'text-ink' : 'text-clay-dark')}
        >
          {stock}
        </span>
        <button
          type="button"
          onClick={() => step('add')}
          aria-label={`One more ${productName} made`}
          className={clsx(button, 'border-sage-dark/30 bg-sage-soft text-sage-dark')}
        >
          +
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 max-w-[12rem] text-right text-[11px] text-clay-dark">
          {error}
        </p>
      )}
    </div>
  )
}
