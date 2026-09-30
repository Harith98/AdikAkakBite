'use client'

import { useEffect, useRef } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { logTransaction, type LogTransactionState } from '@/app/(app)/business/inventory/actions'

const initialState: LogTransactionState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

const TYPES = [
  { value: 'purchase', label: 'Purchase (add stock)' },
  { value: 'usage', label: 'Usage (used in production)' },
  { value: 'waste', label: 'Waste (spoiled / discarded)' },
  { value: 'adjustment', label: 'Adjustment (correct a stock count)' },
] as const

export function TransactionForm({ itemId, unit }: { itemId: string; unit: string }) {
  const action = logTransaction.bind(null, itemId)
  const [state, formAction] = useFormState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.nonce !== 0) formRef.current?.reset()
  }, [state.nonce])

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <select name="transactionType" defaultValue="usage" aria-label="Transaction type" className={input}>
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Quantity ({unit})
          <input name="quantity" required inputMode="decimal" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Date
          <input type="date" name="transactionDate" className={input} />
        </label>
      </div>
      <input name="reference" maxLength={100} placeholder="Reference (optional)" aria-label="Reference" className={input} />
      {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
      {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Recorded.</p>}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      {pending ? 'Recording…' : 'Log transaction'}
    </Button>
  )
}
