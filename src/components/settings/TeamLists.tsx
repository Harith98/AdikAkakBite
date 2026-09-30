'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  changeMemberRole,
  leaveBusiness,
  removeMember,
  resetMemberPassword,
  transferOwnership,
  type ActionResult,
  type Credentials,
} from '@/app/(app)/settings/team/actions'
import type { BusinessMemberRole } from '@/lib/supabase/database.types'
import { ROLE_LABELS } from '@/lib/team'
import { CredentialsCard } from './AddMemberForm'

const ROLE_TONE: Record<BusinessMemberRole, 'raspberry' | 'amber' | 'neutral'> = {
  owner: 'raspberry',
  admin: 'amber',
  staff: 'neutral',
}

/** Shared pending/error handling for the one-tap team actions. */
function useTeamAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Resolves true when the action succeeded. */
  async function run(action: () => Promise<ActionResult>): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError("You're offline. This change can't be saved until your connection returns.")
      return false
    }
    setError(null)
    setPending(true)
    try {
      const result = await action()
      if (result.error) setError(result.error)
      return !result.error
    } catch {
      setError('Something went wrong. Please try again.')
      return false
    } finally {
      setPending(false)
    }
  }

  return { pending, error, run }
}

export interface MemberRowProps {
  memberId: string
  email: string
  /** Their own name, if they've set one; the email is shown instead otherwise. */
  displayName: string | null
  role: BusinessMemberRole
  joinedLabel: string
  isYou: boolean
  /** Roles the viewer may switch this member to; empty = read-only row. */
  assignable: BusinessMemberRole[]
}

export function MemberRow({ memberId, email, displayName, role, joinedLabel, isYou, assignable }: MemberRowProps) {
  const { pending, error, run } = useTeamAction()
  const canEdit = assignable.length > 0 && !isYou
  const label = displayName ?? email
  const [newCredentials, setNewCredentials] = useState<Credentials | null>(null)

  function resetPassword() {
    if (!confirm(`Give ${label} a new temporary password? Their current password stops working straight away.`)) return
    void run(async () => {
      const result = await resetMemberPassword(memberId)
      if (result.credentials) setNewCredentials(result.credentials)
      return result
    })
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {label}
            {isYou && <span className="font-normal text-ink-muted"> (you)</span>}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {displayName ? `${email} · ` : ''}Joined {joinedLabel}
          </p>
        </div>
        {!canEdit && <Badge tone={ROLE_TONE[role]}>{ROLE_LABELS[role]}</Badge>}
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <select
            value={role}
            disabled={pending}
            aria-label={`Role for ${label}`}
            onChange={(e) => run(() => changeMemberRole(memberId, e.target.value))}
            className="h-11 flex-1 rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
          >
            {assignable.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            className="text-clay-dark"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove ${label} from the team? Their login is deleted and they can't sign in any more.`)) {
                void run(() => removeMember(memberId))
              }
            }}
          >
            Remove
          </Button>
        </div>
      )}
      {canEdit && (
        <Button type="button" variant="secondary" disabled={pending} onClick={resetPassword} className="w-full">
          Reset password
        </Button>
      )}
      {newCredentials && <CredentialsCard credentials={newCredentials} heading="New temporary password" />}
      {error && <p role="alert" className="text-sm text-clay-dark">{error}</p>}
    </li>
  )
}

export function TransferOwnershipForm({
  businessName,
  candidates,
}: {
  businessName: string
  candidates: { memberId: string; label: string; role: BusinessMemberRole }[]
}) {
  const { pending, error, run } = useTeamAction()
  const [memberId, setMemberId] = useState('')
  const chosen = candidates.find((c) => c.memberId === memberId)

  function submit() {
    if (!chosen) return
    const typed = window.prompt(
      `Make ${chosen.label} the owner of ${businessName}?\n\nYou'll become an admin: you keep settings and staff access, but lose control of admins and can't undo this yourself.\n\nType the business name to confirm:`
    )
    if (typed === null) return
    if (typed.trim().toLowerCase() !== businessName.trim().toLowerCase()) {
      window.alert("The name didn't match, so nothing was changed.")
      return
    }
    void run(() => transferOwnership(chosen.memberId)).then((ok) => {
      if (ok) window.location.assign('/settings/team')
    })
  }

  if (candidates.length === 0) {
    return <p className="text-sm text-ink-muted">Add someone first. Ownership can only go to an existing team member.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={memberId}
        onChange={(e) => setMemberId(e.target.value)}
        disabled={pending}
        aria-label="New owner"
        className="h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry"
      >
        <option value="">Choose the new owner…</option>
        {candidates.map((c) => (
          <option key={c.memberId} value={c.memberId}>
            {c.label} ({ROLE_LABELS[c.role]})
          </option>
        ))}
      </select>
      <Button type="button" variant="danger" disabled={!chosen || pending} onClick={submit} className="w-full">
        {pending ? 'Transferring…' : 'Transfer ownership'}
      </Button>
      {error && <p role="alert" className="text-sm text-clay-dark">{error}</p>}
    </div>
  )
}

export function LeaveBusinessButton({ businessName }: { businessName: string }) {
  const { pending, error, run } = useTeamAction()
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        className="w-full text-clay-dark"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Leave ${businessName}? You'll lose access until an owner or admin adds you back.`)) return
          void run(leaveBusiness).then((ok) => {
            // Full reload: every cached page for the old business must go.
            if (ok) window.location.assign('/no-access')
          })
        }}
      >
        {pending ? 'Leaving…' : `Leave ${businessName}`}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-clay-dark">{error}</p>}
    </div>
  )
}
