'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { saveCustomer, type SaveCustomerState } from '@/app/(app)/business/customers/actions'

const initialState: SaveCustomerState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

export function CustomerForm({ customer }: { customer: { id: string; name: string; phone: string | null; email: string | null; notes: string | null } }) {
  const [state, formAction] = useFormState(saveCustomer, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="customerId" value={customer.id} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Name</span>
        <input name="name" required maxLength={120} defaultValue={customer.name} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Phone</span>
          <input name="phone" inputMode="tel" maxLength={30} defaultValue={customer.phone ?? ''} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input name="email" type="email" maxLength={200} defaultValue={customer.email ?? ''} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Notes</span>
        <textarea name="notes" rows={3} maxLength={500} defaultValue={customer.notes ?? ''} className="rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry" />
      </label>
      {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
      {state.nonce !== 0 && !state.error && <p className="text-sm text-sage-dark">Saved.</p>}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  )
}
