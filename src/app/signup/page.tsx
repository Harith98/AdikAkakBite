import { createClient } from '@/lib/supabase/server'
import { isAppSetUp } from '@/lib/services/setup'
import { safeNextPath } from '@/lib/validation/common'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/LinkButton'
import { SignupForm } from './SignupForm'

/**
 * Accounts are created in exactly two situations:
 *  - from an invite link (next=/invite/…), to join the team, or
 *  - by the owner, once, before the business exists (first-time setup).
 * Anyone else is told the app is invite-only.
 */
export default async function SignupPage({ searchParams }: { searchParams: { next?: string; email?: string } }) {
  const requested = safeNextPath(searchParams.next, '/onboarding')
  const isInvite = requested.startsWith('/invite/')

  if (!isInvite && (await isAppSetUp(createClient()))) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
        <div className="w-full max-w-sm">
          <p className="mb-8 text-center font-display text-3xl text-ink">Invite only</p>
          <Card>
            <p className="text-sm text-ink">New accounts are by invitation.</p>
            <p className="mt-2 text-sm text-ink-muted">
              Ask the owner to send you an invite link, then open it to create your account and join the team.
            </p>
            <LinkButton href="/login" variant="secondary" className="mt-5 w-full">
              Back to sign in
            </LinkButton>
          </Card>
        </div>
      </div>
    )
  }

  return <SignupForm next={isInvite ? requested : '/onboarding'} initialEmail={searchParams.email ?? ''} />
}
