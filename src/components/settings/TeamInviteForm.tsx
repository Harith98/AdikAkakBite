'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { inviteMember, type InviteState } from '@/app/(app)/settings/team/actions'
import type { BusinessMemberRole } from '@/lib/supabase/database.types'
import { INVITE_EXPIRY_DAYS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/team'

const initialState: InviteState = { error: null, token: null, email: null }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

export function TeamInviteForm({ roles }: { roles: BusinessMemberRole[] }) {
  const [state, formAction] = useFormState(inviteMember, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.token) formRef.current?.reset()
  }, [state.token])

  return (
    <div className="flex flex-col gap-3">
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input name="email" type="email" required maxLength={200} autoComplete="off" placeholder="name@example.com" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Role</span>
          <select name="role" defaultValue="staff" className={input}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]} — {ROLE_DESCRIPTIONS[role]}
              </option>
            ))}
          </select>
        </label>
        {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
        <SubmitButton />
      </form>

      {state.token && state.email && (
        <div className="rounded-card bg-sage-soft p-4 text-sm">
          <p className="font-medium text-sage-dark">Invite ready for {state.email}</p>
          <p className="mt-1 text-ink-muted">
            Send them this link. They sign in or create an account with that email to join. It expires in {INVITE_EXPIRY_DAYS} days.
          </p>
          <InviteLinkShare token={state.token} className="mt-3" />
        </div>
      )}
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Creating invite…' : 'Create invite link'}
    </Button>
  )
}

/** Copy / WhatsApp buttons for an invite link. The origin is read in the browser so it's right on any deployment. */
export function InviteLinkShare({ token, className }: { token: string; className?: string }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])

  const link = `${origin}/invite/${token}`
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`You're invited to join our team on AdikAkak Bite: ${link}`)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this invite link:', link)
    }
  }

  return (
    <div className={className}>
      <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className={`${input} text-xs`} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={copy} disabled={!origin}>
          {copied ? 'Copied ✓' : 'Copy link'}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-pill border border-ink/10 bg-base-soft px-4 text-sm font-medium text-ink hover:bg-amber-soft"
        >
          Send on WhatsApp
        </a>
      </div>
    </div>
  )
}
