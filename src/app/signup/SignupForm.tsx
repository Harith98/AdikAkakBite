'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/**
 * `next` is either an invite link (joining the team) or /onboarding (the
 * owner's one-time first setup) — page.tsx decides which is allowed.
 */
export function SignupForm({ next, initialEmail }: { next: string; initialEmail: string }) {
  const router = useRouter()
  const isInvite = next.startsWith('/invite/')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        // The person's own name (greeting, Team page); editable later in Settings → Your profile.
        data: { display_name: name.trim() || null },
      },
    })

    setIsSubmitting(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // If email confirmation is off in the Supabase project, we already have
    // a session and can go straight on. Otherwise, ask them to check their inbox.
    if (data.session) {
      router.push(next)
      router.refresh()
    } else {
      setConfirmationSent(true)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl text-ink">{isInvite ? 'Create your account' : 'First-time setup'}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {isInvite ? 'Then you can accept your team invite' : 'Create the owner account, then set up the business'}
          </p>
        </div>

        <Card>
          {confirmationSent ? (
            <p className="text-sm text-ink">
              Check <strong>{email}</strong> to confirm your account. The link in that email brings you straight back
              {isInvite ? ' to your invite.' : ' to finish setup.'}
            </p>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Your name</span>
                <input
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
                />
              </label>
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
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-card border border-ink/15 bg-base px-3 text-ink outline-none focus:border-raspberry"
                />
                <span className="text-xs text-ink-faint">At least 8 characters.</span>
              </label>

              {error && <p className="text-sm text-clay">{error}</p>}

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link href={isInvite ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-medium text-raspberry">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
