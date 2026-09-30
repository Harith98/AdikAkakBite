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
export function LoginForm({ next, isSetUp }: { next: string; isSetUp: boolean }) {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <img
              src="/icons/iconAdik192x192.png"
              alt="AdikAkak App icon"
              className="h-24 w-24 object-contain drop-shadow-sm"
            />
          </div>
          <p className="font-display text-3xl text-ink">AdikAkak App</p>
          <p className="mt-1 text-sm text-ink-muted">Your dessert business control centre</p>
        </div>

        <Card>
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
                  className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">Password</span>
                  <Link href="/forgot-password" className="text-xs font-medium text-raspberry">
                    Forgot password?
                  </Link>
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
                />
              </label>

              {error && <p className="text-sm text-clay">{error}</p>}
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
