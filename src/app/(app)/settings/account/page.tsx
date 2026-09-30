import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { Card } from '@/components/ui/Card'
import { ChangeEmailForm, ChangePasswordForm } from '@/components/settings/AccountSecurityForms'

export default async function AccountPage({ searchParams }: { searchParams: { email?: string } }) {
  await getCurrentBusinessContext() // members only, same as the rest of Settings
  // Middleware has already verified this session for the request.
  const {
    data: { session },
  } = await createClient().auth.getSession()
  const email = session?.user.email ?? ''
  const pendingEmail = session?.user.new_email ?? null

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <Link href="/settings" className="text-sm text-ink-muted">
          ← Settings
        </Link>
        <p className="mt-2 font-display text-3xl text-ink">Email &amp; password</p>
        <p className="mt-1 text-sm text-ink-muted">How you sign in to the app.</p>
      </header>

      {searchParams.email === 'confirmed' && (
        <Card className="border border-sage/40">
          <p className="text-sm text-sage-dark">
            {pendingEmail
              ? 'Link confirmed. If a confirmation was also sent to your other address, click that one too to finish.'
              : `Your email is now ${email}.`}
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Email</p>
        <ChangeEmailForm currentEmail={email} pendingEmail={pendingEmail} />
      </Card>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Password</p>
        <ChangePasswordForm email={email} />
      </Card>
    </div>
  )
}
