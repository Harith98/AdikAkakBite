'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { updateMyName, type ProfileState } from '@/app/(app)/settings/actions'

const initialState: ProfileState = { error: null, nonce: 0 }

export function ProfileForm({ displayName, email }: { displayName: string | null; email: string | null }) {
  const [state, formAction] = useFormState(updateMyName, initialState)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Your name</span>
        <input
          name="displayName"
          maxLength={80}
          defaultValue={displayName ?? ''}
          placeholder="e.g. Aina"
          autoComplete="name"
          className="h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
        />
        <span className="text-xs text-ink-faint">
          Used to greet you on Today and shown to your team{email ? ` · signed in as ${email}` : ''}.
        </span>
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
    <Button type="submit" variant="secondary" disabled={pending} className="w-full">
      {pending ? 'Saving…' : 'Save name'}
    </Button>
  )
}
