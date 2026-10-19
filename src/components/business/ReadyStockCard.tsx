'use client'

import { useState } from 'react'
import clsx from '@/lib/clsx'
import { readyStockLabel, readyStockState } from '@/lib/calc/products'
import { changeReadyStock, type ReadyStockChange, type ReadyStockResult } from '@/app/(app)/business/products/actions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

/** Ready stock for one product: start tracking, add a batch, remove some, correct the count, or stop. */
export function ReadyStockCard({ productId, initialStock }: { productId: string; initialStock: number | null }) {
  const [stock, setStock] = useState(initialStock)
  const [quantity, setQuantity] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function run(change: ReadyStockChange) {
    const value = change === 'untrack' ? 0 : Number(quantity)
    if (change !== 'untrack' && (!Number.isInteger(value) || value < 0 || quantity.trim() === '')) {
      setMessage({ ok: false, text: 'Enter a whole number.' })
      return
    }
    if (change === 'untrack' && !window.confirm('Stop tracking ready stock for this product? Orders won’t change its count anymore.')) return
    setBusy(true)
    setMessage(null)
    const result: ReadyStockResult = await changeReadyStock(productId, change, value).catch(() => ({
      error: 'Could not save. Check your connection.',
      readyStock: null,
    }))
    setBusy(false)
    if (result.error) {
      setMessage({ ok: false, text: result.error })
      return
    }
    setStock(result.readyStock)
    setQuantity('')
    const done: Record<ReadyStockChange, string> = {
      add: result.ingredientsUsed
        ? `Added ${value}. Ingredients for the batch were taken out of inventory.`
        : `Added ${value}.`,
      remove: `Removed ${value}.`,
      set: `Count set to ${value}.`,
      untrack: 'No longer tracking ready stock.',
    }
    setMessage({ ok: true, text: done[change] })
  }

  const state = readyStockState(stock)

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Ready stock</p>

      {state === 'untracked' ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Track how many are baked and ready to sell. Completed orders take them off automatically. Leave this off for
            made-to-order items.
          </p>
          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              placeholder="How many ready now?"
              aria-label="Starting ready stock"
              className={input}
            />
            <Button type="button" onClick={() => run('set')} disabled={busy} className="shrink-0">
              Start tracking
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p
            className={clsx(
              'font-display text-4xl',
              state === 'in_stock' ? 'text-ink' : 'text-clay-dark'
            )}
          >
            {state === 'in_stock' ? (
              <>
                {stock}
                <span className="ml-2 font-body text-sm font-medium text-ink-muted">ready</span>
              </>
            ) : (
              readyStockLabel(stock)
            )}
          </p>
          {state === 'short' && (
            <p className="text-sm text-clay-dark">
              More were sold than were recorded as ready. Count what&apos;s on hand and use Set count to correct it.
            </p>
          )}
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="numeric"
            placeholder="How many?"
            aria-label="Quantity"
            className={input}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="success" onClick={() => run('add')} disabled={busy}>
              + Add batch
            </Button>
            <Button type="button" variant="secondary" onClick={() => run('set')} disabled={busy}>
              Set count
            </Button>
          </div>
          <ul className="flex flex-col gap-1 text-xs text-ink-muted">
            <li>
              <span className="font-medium text-ink">Add batch</span>: you just made more. Adds to the count and takes the
              recipe&apos;s ingredients out of inventory.
            </li>
            <li>
              <span className="font-medium text-ink">Set count</span>: type how many are actually on hand, e.g. after some
              were eaten, given away or spoiled. Ingredients aren&apos;t touched.
            </li>
            <li>Completed orders take sold items off automatically.</li>
          </ul>
          <Button type="button" variant="ghost" onClick={() => run('untrack')} disabled={busy} className="self-start text-ink-muted">
            Stop tracking
          </Button>
        </div>
      )}

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={clsx('mt-3 text-sm', message.ok ? 'text-sage-dark' : 'text-clay-dark')}>
          {message.text}
        </p>
      )}
    </Card>
  )
}
