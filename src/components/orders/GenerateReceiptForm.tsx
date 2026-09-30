'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { issueReceipt, type IssueReceiptState } from '@/app/(app)/orders/actions'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/lib/receipts'
import type { PaymentMethod } from '@/lib/supabase/database.types'

const initialState: IssueReceiptState = { error: null }

export function GenerateReceiptForm({
  orderId,
  balanceLabel,
  hasBalance,
  defaultMethod,
}: {
  orderId: string
  /** Formatted outstanding amount, e.g. "RM 20.00". */
  balanceLabel: string
  hasBalance: boolean
  defaultMethod: PaymentMethod | null
}) {
  const [state, formAction] = useFormState(issueReceipt.bind(null, orderId), initialState)

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">How did the customer pay?</span>
        <select
          name="paymentMethod"
          defaultValue={defaultMethod ?? 'cash'}
          className="h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      {hasBalance && (
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" name="paidInFull" defaultChecked className="mt-0.5 h-4 w-4" />
          <span>
            Customer has now paid the remaining {balanceLabel}
            <span className="block text-xs text-ink-muted">Untick to issue the receipt with a balance still due.</span>
          </span>
        </label>
      )}

      {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Generating…' : 'Generate receipt'}
    </Button>
  )
}
