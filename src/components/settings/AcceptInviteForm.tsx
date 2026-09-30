'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { acceptInvitation, type AcceptInviteState } from '@/app/invite/[token]/actions'

const initialState: AcceptInviteState = { error: null }

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(acceptInvitation.bind(null, token), initialState)
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? 'Joining…' : 'Accept and join'}
    </Button>
  )
}
