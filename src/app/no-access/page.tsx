import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMembership, isAppSetUp } from '@/lib/services/setup'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { signOut } from '@/app/(app)/settings/actions'

/**
 * Signed in, but not on the team (never invited, removed, or left). This is a
 * single-business app, so there's nothing to create — only an invite gets in.
 */
export default async function NoAccessPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (await hasMembership(supabase, user.id)) redirect('/today')
  if (!(await isAppSetUp(supabase))) redirect('/onboarding')

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/iconAdik192x192.png" alt="" className="h-20 w-20 object-contain" />
          </div>
          <p className="font-display text-3xl text-ink">No access yet</p>
        </div>
        <Card>
          <p className="text-sm text-ink">
            You&apos;re signed in as <strong>{user.email}</strong>, but this account isn&apos;t on the team.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Ask the owner to send an invite link to this email address, then open the link to join.
          </p>
          <form action={signOut} className="mt-5">
            <Button type="submit" variant="secondary" className="w-full">
              Sign in with a different account
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
