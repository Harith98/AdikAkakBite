import { createClient } from '@/lib/supabase/server'
import { isAppSetUp } from '@/lib/services/setup'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/LinkButton'
import { SignupForm } from './SignupForm'

/**
 * Self sign-up exists for one moment only: the owner's first-time setup,
 * before the business exists. After that, owners/admins create everyone
 * else's account in Settings → Team.
 */
export default async function SignupPage() {
  if (await isAppSetUp(createClient())) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
        <div className="w-full max-w-sm">
          <p className="mb-8 text-center font-display text-3xl text-ink">Ask for an account</p>
          <Card>
            <p className="text-sm text-ink">Accounts are created by the owner or an admin.</p>
            <p className="mt-2 text-sm text-ink-muted">
              Ask them to add you in Settings → Team. They&apos;ll give you an email and a temporary password to sign in with.
            </p>
            <LinkButton href="/login" variant="secondary" className="mt-5 w-full">
              Back to sign in
            </LinkButton>
          </Card>
        </div>
      </div>
    )
  }

  return <SignupForm />
}
