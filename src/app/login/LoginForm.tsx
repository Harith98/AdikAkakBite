'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { authCallbackUrl } from '@/lib/site-url'

/** `next` is already validated by page.tsx; `isSetUp` = the business exists (so no self-signup). */
export function LoginForm({ next, isSetUp }: { next: string; isSetUp: boolean }) {
  const router = useRouter()
  const isInvite = next.startsWith('/invite/')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setIsSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    router.push(next)
    router.refresh()
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Enter your email first.')
      return
    }
    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl(next) },
    })

    setIsSubmitting(false)
    if (otpError) {
      setError(otpError.message)
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
            <p className="text-sm text-ink">
              Check <strong>{email}</strong> for a sign-in link.
            </p>
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
                <span className="font-medium text-ink">Password</span>
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
          {isInvite ? (
            <>
              New here?{' '}
              <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-raspberry">
                Create your account
              </Link>
            </>
          ) : !isSetUp ? (
            <>
              First time?{' '}
              <Link href="/signup" className="font-medium text-raspberry">
                Set up the business
              </Link>
            </>
          ) : (
            'Need access? Ask the owner to send you an invite link.'
          )}
        </p>
      </div>
    </div>
  )
}
