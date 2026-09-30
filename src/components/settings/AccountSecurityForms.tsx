'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { friendlyEmailError, ResendEmailButton } from '@/components/auth/ResendEmailButton'
import { authCallbackUrl } from '@/lib/site-url'
import { MIN_PASSWORD_LENGTH } from '@/lib/team'

const input = 'h-11 w-full rounded-card border border-ink/15 bg-base px-3 text-sm outline-none focus:border-raspberry'

type Status = { ok: boolean; text: string } | null

function StatusLine({ status }: { status: Status }) {
  if (!status) return null
  return (
    <p role={status.ok ? 'status' : 'alert'} className={status.ok ? 'text-sm text-sage-dark' : 'text-sm text-clay-dark'}>
      {status.text}
    </p>
  )
}

/**
 * Change email. Supabase sends a confirmation link; with "Secure email change"
 * on (the default) it sends one to BOTH the old and new address, and the
 * change only happens once both are clicked.
 */
export function ChangeEmailForm({ currentEmail, pendingEmail }: { currentEmail: string; pendingEmail: string | null }) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [sentTo, setSentTo] = useState<string | null>(pendingEmail)

  const requestChange = async (email: string): Promise<string | null> => {
    const { error } = await createClient().auth.updateUser(
      { email },
      { emailRedirectTo: authCallbackUrl('/settings/account?email=confirmed') }
    )
    return error?.message ?? null
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const email = newEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setStatus({ ok: false, text: 'Enter a valid email address.' })
    if (email === currentEmail.toLowerCase()) return setStatus({ ok: false, text: 'That’s already your email.' })

    setPending(true)
    setStatus(null)
    const error = await requestChange(email)
    setPending(false)
    if (error) return setStatus({ ok: false, text: friendlyEmailError(error) })
    setSentTo(email)
    setNewEmail('')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink">
        Current email: <strong>{currentEmail}</strong>
      </p>

      {sentTo && (
        <div className="flex flex-col gap-3 rounded-card bg-amber-soft p-4 text-sm">
          <p className="text-ink">
            Waiting for confirmation of <strong>{sentTo}</strong>. Click the link we emailed to it. If a link was also sent to{' '}
            <strong>{currentEmail}</strong>, click that one too. Your email changes once every link is clicked.
          </p>
          <ResendEmailButton label="Resend confirmation" onResend={() => requestChange(sentTo)} startWithCooldown={!pendingEmail} />
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">New email</span>
          <input type="email" required autoComplete="email" maxLength={200} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={input} />
        </label>
        <StatusLine status={status} />
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? 'Sending…' : 'Change email'}
        </Button>
      </form>
    </div>
  )
}

/**
 * Change password. The current password is checked first (by signing in with
 * it), so an unlocked phone isn't enough to take over the account — and the
 * fresh sign-in also satisfies Supabase's "recent login" rule for password changes.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [resetSent, setResetSent] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (next.length < MIN_PASSWORD_LENGTH) return setStatus({ ok: false, text: `Use at least ${MIN_PASSWORD_LENGTH} characters.` })
    if (next !== confirm) return setStatus({ ok: false, text: 'The new passwords don’t match.' })
    if (next === current) return setStatus({ ok: false, text: 'Choose a password different from your current one.' })

    setPending(true)
    setStatus(null)
    const supabase = createClient()
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current })
    if (checkError) {
      setPending(false)
      return setStatus({
        ok: false,
        text: /invalid login credentials/i.test(checkError.message) ? 'Your current password is wrong.' : checkError.message,
      })
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    setPending(false)
    if (error) return setStatus({ ok: false, text: error.message })

    setCurrent('')
    setNext('')
    setConfirm('')
    setStatus({ ok: true, text: 'Password changed. Use the new one next time you sign in.' })
  }

  const sendReset = async (): Promise<string | null> => {
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: authCallbackUrl('/reset-password') })
    return error?.message ?? null
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-3">
        {/* Lets password managers attach the new password to the right account. */}
        <input type="email" autoComplete="username" value={email} readOnly hidden />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Current password</span>
          <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">New password</span>
          <input type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={input} />
          <span className="text-xs text-ink-faint">At least {MIN_PASSWORD_LENGTH} characters.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Confirm new password</span>
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        </label>
        <StatusLine status={status} />
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? 'Saving…' : 'Change password'}
        </Button>
      </form>

      <div className="border-t border-ink/10 pt-3">
        {resetSent ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">Reset link sent to {email}. Open it to choose a new password.</p>
            <ResendEmailButton label="Resend reset link" onResend={sendReset} />
          </div>
        ) : (
          <button
            type="button"
            className="text-sm font-medium text-raspberry"
            onClick={async () => {
              const error = await sendReset()
              if (error) setStatus({ ok: false, text: friendlyEmailError(error) })
              else setResetSent(true)
            }}
          >
            Don’t know your current password? Email me a reset link
          </button>
        )}
      </div>
    </div>
  )
}
