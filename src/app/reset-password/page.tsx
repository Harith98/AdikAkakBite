'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MIN_PASSWORD_LENGTH } from '@/lib/team'

/**
 * Choose a new password, reached two ways — both already signed in
 * (middleware sends anyone without a session to /login), so no current
 * password is asked for:
 *  - first sign-in with a temporary password set by an owner/admin
 *    (getCurrentBusinessContext redirects here while must_change_password is set)
 *  - a password-reset email link
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (password !== confirm) return setError('The passwords don’t match.')

    setError(null)
    setPending(true)
    const { error: updateError } = await createClient().auth.updateUser({
      password,
      data: { must_change_password: null }, // temporary password replaced — let them into the app
    })
    setPending(false)
    if (updateError) {
      return setError(
        /should be different/i.test(updateError.message) ? 'Choose a password different from the temporary one.' : updateError.message
      )
    }
    router.push('/today')
    router.refresh()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-ink">Choose your password</p>
          <p className="mt-1 text-sm text-ink-muted">Pick one only you know. You&apos;ll use it to sign in from now on.</p>
        </div>
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">New password</span>
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
              />
              <span className="text-xs text-ink-faint">At least {MIN_PASSWORD_LENGTH} characters.</span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink">Confirm new password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
              />
            </label>
            {error && <p role="alert" className="text-sm text-clay-dark">{error}</p>}
            <Button type="submit" size="lg" disabled={pending} className="w-full">
              {pending ? 'Saving…' : 'Save new password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
