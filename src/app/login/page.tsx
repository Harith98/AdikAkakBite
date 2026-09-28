'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/today'

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
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${next}` },
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
          New here?{' '}
          <Link href="/signup" className="font-medium text-raspberry">
            Create your business
          </Link>
        </p>
      </div>
    </div>
  )
}

// useSearchParams() must sit under a Suspense boundary or `next build` fails.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
