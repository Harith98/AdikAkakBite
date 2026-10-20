'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { authCallbackUrl } from '@/lib/site-url'
import { friendlyEmailError, ResendEmailButton } from '@/components/auth/ResendEmailButton'

/** `next` is already validated by page.tsx; `isSetUp` = the business exists (so no self-signup). */
export function LoginForm({ next, isSetUp, businessName }: { next: string; isSetUp: boolean; businessName: string }) {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  // Signed up but never clicked the confirmation email.
  const [notConfirmed, setNotConfirmed] = useState(false)

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotConfirmed(false)
    setIsSubmitting(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setIsSubmitting(false)
    if (signInError) {
      if (signInError.code === 'email_not_confirmed' || /not confirmed/i.test(signInError.message)) {
        setNotConfirmed(true)
        setError('Your email isn’t confirmed yet. Click the link in the confirmation email, or send a new one below.')
        return
      }
      setError(signInError.message)
      return
    }
    router.push(next)
    router.refresh()
  }

  const sendMagicLink = async (): Promise<string | null> => {
    const { error: otpError } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl(next), shouldCreateUser: false },
    })
    return otpError?.message ?? null
  }

  const resendConfirmation = async (): Promise<string | null> => {
    const { error: resendError } = await createClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: authCallbackUrl(next) },
    })
    return resendError?.message ?? null
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Enter your email first.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    const otpError = await sendMagicLink()
    setIsSubmitting(false)
    if (otpError) {
      setError(friendlyEmailError(otpError))
      return
    }
    setMagicLinkSent(true)
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-base px-4 py-10">
      {/* Same warm wash and floating treats as the customer menu. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-raspberry-soft via-amber-soft/60 to-base" />
      <span aria-hidden="true" className="pointer-events-none absolute left-6 top-12 rotate-[-12deg] text-3xl opacity-50">🧁</span>
      <span aria-hidden="true" className="pointer-events-none absolute right-8 top-28 rotate-12 text-2xl opacity-40">🍰</span>
      <span aria-hidden="true" className="pointer-events-none absolute bottom-16 left-10 rotate-6 text-2xl opacity-30">🍫</span>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="h-24 w-24 overflow-hidden rounded-[26px] bg-white shadow-card ring-4 ring-white/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/iconAdik512x512.png?v=2" alt={`${businessName} logo`} className="h-full w-full object-contain p-1" />
          </span>
          <p className="mt-4 font-display text-3xl leading-tight text-ink">{businessName}</p>
          <p className="mt-1 text-sm text-ink-muted">Semanis Senyuman Kamu 💕</p>
        </div>

        <Card className="!p-6">
          {!magicLinkSent && (
            <div className="mb-5">
              <p className="font-display text-2xl text-ink">Welcome back 👋</p>
              <p className="mt-0.5 text-sm text-ink-muted">Sign in to run the shop.</p>
            </div>
          )}
          {magicLinkSent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ink">
                Check <strong>{email}</strong> for a sign-in link. It can take a minute, and sometimes lands in spam.
              </p>
              <ResendEmailButton label="Resend sign-in link" onResend={sendMagicLink} />
              <button type="button" onClick={() => setMagicLinkSent(false)} className="text-sm font-medium text-raspberry">
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-card border border-ink/15 bg-white px-3 text-ink outline-none transition-colors focus:border-raspberry focus:ring-2 focus:ring-raspberry/15"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">Password</span>
                  <Link href="/forgot-password" className="text-xs font-medium text-raspberry">
                    Forgot password?
                  </Link>
                </span>
                <span className="relative block">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-card border border-ink/15 bg-white pl-3 pr-12 text-ink outline-none transition-colors focus:border-raspberry focus:ring-2 focus:ring-raspberry/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted hover:text-ink"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                      {showPassword && <path d="M4 4l16 16" />}
                    </svg>
                  </button>
                </span>
              </label>

              {error && <p role="alert" className="text-sm text-clay-dark">{error}</p>}
              {notConfirmed && (
                <ResendEmailButton label="Resend confirmation email" onResend={resendConfirmation} startWithCooldown={false} />
              )}

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={handleMagicLink}
                disabled={isSubmitting}
                className="w-full"
              >
                Email me a sign-in link instead
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {!isSetUp ? (
            <>
              First time?{' '}
              <Link href="/signup" className="font-medium text-raspberry">
                Set up the business
              </Link>
            </>
          ) : (
            'No account yet? Ask the owner or an admin to create one for you.'
          )}
        </p>
      </div>
    </div>
  )
}
