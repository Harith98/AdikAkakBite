'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { friendlyEmailError, ResendEmailButton } from '@/components/auth/ResendEmailButton'
import { authCallbackUrl } from '@/lib/site-url'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // The link signs them in and lands on /reset-password to choose a new one.
  const sendReset = async (): Promise<string | null> => {
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authCallbackUrl('/reset-password'),
    })
    return resetError?.message ?? null
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const resetError = await sendReset()
    setPending(false)
    if (resetError) return setError(friendlyEmailError(resetError))
    setSent(true)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-ink">Reset your password</p>
          <p className="mt-1 text-sm text-ink-muted">We&apos;ll email you a link to choose a new one</p>
        </div>
        <Card>
          {sent ? (
            <div className="flex flex-col gap-4">
              {/* Same wording whether or not the account exists, so this page can't be used to check who has one. */}
              <p className="text-sm text-ink">
                If <strong>{email}</strong> has an account, a reset link is on its way. Check your spam folder too.
              </p>
              <ResendEmailButton label="Resend reset link" onResend={sendReset} />
              <button type="button" onClick={() => setSent(false)} className="text-sm font-medium text-raspberry">
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
                />
              </label>
              {error && <p role="alert" className="text-sm text-clay-dark">{error}</p>}
              <Button type="submit" size="lg" disabled={pending} className="w-full">
                {pending ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}
        </Card>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-raspberry">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
