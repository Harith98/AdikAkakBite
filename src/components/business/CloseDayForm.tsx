'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { closeDay, type CloseDayState } from '@/app/(app)/business/sales/actions'

const initialState: CloseDayState = { error: null, nonce: 0 }

export function CloseDayForm({ alreadyClosed }: { alreadyClosed: boolean }) {
  const [state, formAction] = useFormState(closeDay, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Waste today</span>
        <input
          name="wasteValue"
          inputMode="decimal"
          placeholder="0.00"
          className="h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Notes</span>
        <textarea
          name="notes"
          rows={2}
          maxLength={500}
          placeholder="Unfinished tasks, what to prep tomorrow…"
          className="rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
      {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Saved. Revenue and orders were recorded automatically.</p>}
      <SubmitButton alreadyClosed={alreadyClosed} />
    </form>
  )
}

function SubmitButton({ alreadyClosed }: { alreadyClosed: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Saving…' : alreadyClosed ? 'Update today\u2019s close' : 'Close today'}
    </Button>
  )
}
