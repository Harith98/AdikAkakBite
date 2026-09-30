import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { assignableRoles, canManageRole, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/team'
import { Card } from '@/components/ui/Card'
import { AddMemberForm } from '@/components/settings/AddMemberForm'
import { LeaveBusinessButton, MemberRow, TransferOwnershipForm } from '@/components/settings/TeamLists'

const dateLabel = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleDateString('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' })

export default async function TeamPage() {
  const { business, settings, userId, role } = await getCurrentBusinessContext()
  const canAddPeople = assignableRoles(role).length > 0
  // Creating/resetting/deleting logins needs the server-only admin key.
  const adminKeyMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY

  const membersRes = await createClient().rpc('get_business_members', { p_business_id: business.id })
  if (membersRes.error) throw new Error(`Could not load your team: ${membersRes.error.message}`)
  const members = membersRes.data ?? []

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
              displayName={m.display_name ?? null}
              role={m.role}
              joinedLabel={dateLabel(m.joined_at, settings.timezone)}
              isYou={m.user_id === userId}
              assignable={canManageRole(role, m.role) ? assignableRoles(role) : []}
            />
          ))}
        </ul>
      </Card>

      {canAddPeople && (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Add team member</p>
          <p className="mb-3 mt-1 text-sm text-ink-muted">
            Create their account here. No email is sent. Give them the sign-in details and they can start straight away.
          </p>
          {adminKeyMissing ? (
            <p className="rounded-card bg-amber-soft p-3 text-sm text-ink">
              Adding people isn&apos;t switched on yet. The server needs the <strong>SUPABASE_SERVICE_ROLE_KEY</strong>{' '}
              environment variable (Supabase → Project Settings → API keys). Add it in Vercel, then redeploy.
            </p>
          ) : (
            <AddMemberForm roles={assignableRoles(role)} />
          )}
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
              .map((m) => ({ memberId: m.member_id, label: m.display_name ? `${m.display_name} · ${m.email}` : m.email, role: m.role }))}
          />
        </Card>
      )}

      {role !== 'owner' && <LeaveBusinessButton businessName={business.name} />}
    </div>
  )
}
