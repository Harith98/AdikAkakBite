'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { updateBusinessDetails, type BusinessDetailsState } from '@/app/(app)/settings/actions'

const initialState: BusinessDetailsState = { error: null, nonce: 0 }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'
const textarea = 'w-full rounded-card border border-ink/15 bg-base p-3 text-sm outline-none focus:border-raspberry'

export interface BusinessDetails {
  name: string
  phone: string | null
  email: string | null
  address: string | null
  registrationNumber: string | null
  receiptFooter: string | null
}

export function BusinessDetailsForm({ details }: { details: BusinessDetails }) {
  const [state, formAction] = useFormState(updateBusinessDetails, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Business name</span>
        <input name="name" required maxLength={120} defaultValue={details.name} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Phone</span>
          <input name="phone" inputMode="tel" maxLength={30} defaultValue={details.phone ?? ''} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input name="email" type="email" maxLength={200} defaultValue={details.email ?? ''} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Address</span>
        <textarea name="address" rows={2} maxLength={300} defaultValue={details.address ?? ''} className={textarea} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Registration no. (SSM, optional)</span>
        <input name="registrationNumber" maxLength={50} defaultValue={details.registrationNumber ?? ''} placeholder="e.g. 202601012345 (003456789-X)" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Receipt message</span>
        <textarea
          name="receiptFooter"
          rows={2}
          maxLength={300}
          defaultValue={details.receiptFooter ?? ''}
          placeholder="Thank you for your order!"
          className={textarea}
        />
        <span className="text-xs text-ink-faint">Printed at the bottom of every receipt.</span>
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
      {pending ? 'Saving…' : 'Save details'}
    </Button>
  )
}
