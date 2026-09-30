'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { addTeamMember, type AddMemberState, type Credentials } from '@/app/(app)/settings/team/actions'
import type { BusinessMemberRole } from '@/lib/supabase/database.types'
import { siteUrl } from '@/lib/site-url'
import { generateTempPassword, MIN_PASSWORD_LENGTH, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/team'

const initialState: AddMemberState = { error: null, created: null }
const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

/** Owner/admin creates someone's login directly; they can sign in straight away. */
export function AddMemberForm({ roles }: { roles: BusinessMemberRole[] }) {
  const [state, formAction] = useFormState(addTeamMember, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const [password, setPassword] = useState('')

  useEffect(() => setPassword(generateTempPassword()), [])
  useEffect(() => {
    if (!state.created) return
    formRef.current?.reset()
    setPassword(generateTempPassword()) // fresh one ready for the next person
  }, [state.created])

  return (
    <div className="flex flex-col gap-3">
      {state.created && <CredentialsCard credentials={state.created} heading="Account created" />}

      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Name</span>
          <input name="name" required maxLength={80} autoComplete="off" placeholder="e.g. Aina" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email (used to sign in)</span>
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Temporary password</span>
          <div className="flex gap-2">
            <input
              name="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${input} font-mono`}
            />
            <Button type="button" variant="secondary" onClick={() => setPassword(generateTempPassword())}>
              New
            </Button>
          </div>
          <span className="text-xs text-ink-faint">They&apos;ll be asked to choose their own password the first time they sign in.</span>
        </label>
        {state.error && <p role="alert" className="text-sm text-clay-dark">{state.error}</p>}
        <SubmitButton />
      </form>
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Creating account…' : 'Create account'}
    </Button>
  )
}

/**
 * Sign-in details to hand over, shown once. The password isn't stored
 * anywhere readable, so this is the only chance to copy it.
 */
export function CredentialsCard({ credentials, heading }: { credentials: Credentials; heading: string }) {
  const [copied, setCopied] = useState(false)
  const [loginUrl, setLoginUrl] = useState('')
  useEffect(() => setLoginUrl(`${siteUrl()}/login`), [])

  const message = [
    `Hi ${credentials.name}, here are your AdikAkak Bite sign-in details:`,
    loginUrl,
    `Email: ${credentials.email}`,
    `Temporary password: ${credentials.password}`,
    'You’ll choose your own password when you first sign in.',
  ].join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy these sign-in details:', message)
    }
  }

  return (
    <div className="rounded-card bg-sage-soft p-4 text-sm">
      <p className="font-medium text-sage-dark">{heading}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-ink-muted">Email</dt>
        <dd className="break-all text-ink">{credentials.email}</dd>
        <dt className="text-ink-muted">Password</dt>
        <dd className="font-mono text-ink">{credentials.password}</dd>
      </dl>
      <p className="mt-2 text-xs text-ink-muted">Give these to {credentials.name}. This password won&apos;t be shown again.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={copy} disabled={!loginUrl}>
          {copied ? 'Copied ✓' : 'Copy details'}
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
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
