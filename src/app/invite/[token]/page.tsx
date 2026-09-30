import { createClient } from '@/lib/supabase/server'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/team'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LinkButton } from '@/components/ui/LinkButton'
import { AcceptInviteForm } from '@/components/settings/AcceptInviteForm'
import { switchAccount } from './actions'

export default async function InvitePage({ params }: { params: { token: string } }) {
  const token = /^[0-9a-f]{64}$/.test(params.token) ? params.token : null
  const supabase = createClient()

  const [{ data: invites }, { data: { user } }] = await Promise.all([
    token ? supabase.rpc('get_invitation', { p_token: token }) : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
  ])
  const invite = invites?.[0] ?? null
  const next = encodeURIComponent(`/invite/${params.token}`)

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/iconAdik192x192.png" alt="" className="h-20 w-20 object-contain" />
          </div>
          <p className="font-display text-3xl text-ink">
            {invite?.status === 'pending' ? `Join ${invite.business_name}` : 'Team invitation'}
          </p>
        </div>

        <Card>
          {!invite ? (
            <Message title="This link isn't valid" text="Check you copied the whole link, or ask for a new invite." />
          ) : invite.status === 'accepted' ? (
            <Message title="This invite has already been used" text="If that was you, just sign in.">
              <LinkButton href="/login" className="mt-4 w-full">Sign in</LinkButton>
            </Message>
          ) : invite.status === 'expired' ? (
            <Message title="This invite has expired" text={`Ask ${invite.business_name} to send you a new link.`} />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-ink">
                You&apos;ve been invited to <strong>{invite.business_name}</strong> as{' '}
                <strong>{ROLE_LABELS[invite.role]}</strong>.
              </p>
              <p className="text-xs text-ink-muted">{ROLE_DESCRIPTIONS[invite.role]}.</p>

              {!user ? (
                <>
                  <p className="text-sm text-ink-muted">
                    Sign in or create an account with <strong className="text-ink">{invite.email}</strong> to join.
                  </p>
                  <LinkButton href={`/signup?next=${next}&email=${encodeURIComponent(invite.email)}`} className="w-full">
                    Create account
                  </LinkButton>
                  <LinkButton href={`/login?next=${next}`} variant="secondary" className="w-full">
                    I already have an account
                  </LinkButton>
                </>
              ) : user.email?.toLowerCase() !== invite.email ? (
                <>
                  <p className="text-sm text-clay-dark">
                    You&apos;re signed in as {user.email}, but this invite is for {invite.email}.
                  </p>
                  <form action={switchAccount.bind(null, params.token)}>
                    <Button type="submit" variant="secondary" className="w-full">
                      Sign in with a different account
                    </Button>
                  </form>
                </>
              ) : (
                <AcceptInviteForm token={params.token} />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{text}</p>
      {children}
    </div>
  )
}
