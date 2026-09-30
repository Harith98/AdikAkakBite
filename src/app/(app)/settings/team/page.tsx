import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { assignableRoles, canManageRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/team'
import { Card } from '@/components/ui/Card'
import { TeamInviteForm } from '@/components/settings/TeamInviteForm'
import { LeaveBusinessButton, MemberRow, PendingInviteRow, TransferOwnershipForm } from '@/components/settings/TeamLists'

const dateLabel = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' })

export default async function TeamPage() {
  const { business, settings, userId, role } = await getCurrentBusinessContext()
  const supabase = createClient()
  const canInvite = assignableRoles(role).length > 0

  const [membersRes, invitesRes] = await Promise.all([
    supabase.rpc('get_business_members', { p_business_id: business.id }),
    // RLS only returns invitations this user is allowed to manage, so staff get none.
    canInvite
      ? supabase
          .from('business_invitations')
          .select('id, email, role, token, expires_at')
          .eq('business_id', business.id)
          .is('accepted_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (membersRes.error) throw new Error(`Could not load your team: ${membersRes.error.message}`)
  if (invitesRes.error) throw new Error(`Could not load invitations: ${invitesRes.error.message}`)
  const members = membersRes.data ?? []
  const invites = invitesRes.data ?? []
  const now = Date.now()

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <Link href="/settings" className="text-sm text-ink-muted">
          ← Settings
        </Link>
        <p className="mt-2 font-display text-3xl text-ink">Team</p>
        <p className="mt-1 text-sm text-ink-muted">
          Who can use {business.name}. Your role: {ROLE_LABELS[role]}.
        </p>
      </header>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Members · {members.length}</p>
        <ul className="mt-1 divide-y divide-ink/10">
          {members.map((m) => (
            <MemberRow
              key={m.member_id}
              memberId={m.member_id}
              email={m.email}
              role={m.role}
              joinedLabel={dateLabel(m.joined_at, settings.timezone)}
              isYou={m.user_id === userId}
              assignable={canManageRole(role, m.role) ? assignableRoles(role) : []}
            />
          ))}
        </ul>
      </Card>

      {canInvite && invites.length > 0 && (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Pending invites · {invites.length}</p>
          <ul className="mt-1 divide-y divide-ink/10">
            {invites.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                invitationId={inv.id}
                email={inv.email}
                role={inv.role}
                token={inv.token}
                expiresLabel={dateLabel(inv.expires_at, settings.timezone)}
                isExpired={new Date(inv.expires_at).getTime() < now}
              />
            ))}
          </ul>
        </Card>
      )}

      {canInvite && (
        <Card>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Invite someone</p>
          <TeamInviteForm roles={assignableRoles(role)} />
        </Card>
      )}

      <Card className="border border-dashed border-ink/15 bg-transparent shadow-none">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">What each role can do</p>
        <dl className="mt-2 flex flex-col gap-2 text-sm">
          {(['owner', 'admin', 'staff'] as const).map((r) => (
            <div key={r}>
              <dt className="inline font-medium text-ink">{ROLE_LABELS[r]}: </dt>
              <dd className="inline text-ink-muted">{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {role === 'owner' && (
        <Card className="border border-clay/40">
          <p className="text-xs font-medium uppercase tracking-wide text-clay-dark">Transfer ownership</p>
          <p className="mb-3 mt-1 text-sm text-ink-muted">
            Hand the business to another team member. They become the owner and you become an admin. Only the new
            owner can transfer it back.
          </p>
          <TransferOwnershipForm
            businessName={business.name}
            candidates={members
              .filter((m) => m.user_id !== userId)
              .map((m) => ({ memberId: m.member_id, email: m.email, role: m.role }))}
          />
        </Card>
      )}

      {role !== 'owner' && <LeaveBusinessButton businessName={business.name} />}
    </div>
  )
}
