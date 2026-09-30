import Link from 'next/link'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { canManageBusiness, ROLE_LABELS } from '@/lib/team'
import { BusinessDetailsForm } from '@/components/settings/BusinessDetailsForm'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { signOut } from './actions'

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
}

export default async function SettingsPage() {
  const { business, settings, role, displayName, userEmail } = await getCurrentBusinessContext()

  const workingDaysLabel = settings.working_days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ')

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <p className="font-display text-3xl text-ink">Settings</p>
        <p className="mt-1 text-sm text-ink-muted">Your business details and preferences</p>
      </header>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Your profile</p>
        <ProfileForm displayName={displayName} email={userEmail} />
      </Card>

      <NavCard href="/settings/account" title="Email & password" text="Change the email or password you sign in with" />

      <NavCard
        href="/settings/notifications"
        title="Notifications"
        text="Low stock, order reminders and schedule changes on your phone"
      />

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Business</p>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <Row label="Name" value={business.name} />
          <Row label="Owner" value={business.owner_name ?? '—'} />
          <Row label="Currency" value={settings.currency} />
          <Row label="Timezone" value={settings.timezone} />
          <Row
            label="Working hours"
            value={`${settings.working_hours_start.slice(0, 5)} – ${settings.working_hours_end.slice(0, 5)}`}
          />
          <Row label="Working days" value={workingDaysLabel} />
          <Row label="Your role" value={ROLE_LABELS[role]} />
        </dl>
      </Card>

      {canManageBusiness(role) && (
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Business &amp; receipt details</p>
          <p className="mb-3 mt-1 text-sm text-ink-muted">Shown at the top of every receipt you generate.</p>
          <BusinessDetailsForm
            details={{
              name: business.name,
              ownerName: business.owner_name,
              phone: business.phone,
              email: business.email,
              address: business.address,
              registrationNumber: business.registration_number,
              receiptFooter: business.receipt_footer,
            }}
          />
        </Card>
      )}

      <NavCard
        href="/settings/team"
        title="Team"
        text={canManageBusiness(role) ? 'Add people and manage who has access' : 'See who is on the team'}
      />

      {canManageBusiness(role) && (
        <NavCard href="/settings/schedule" title="Daily schedule" text="Edit the blocks and tasks that shape your day" />
      )}

      <Card className="border border-dashed border-ink/15 bg-transparent shadow-none">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Coming in a later phase
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Editing these values in place, forecast settings and data
          export (CSV) land alongside the modules they belong to.
        </p>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  )
}

function NavCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="block">
      <Card className="flex items-center justify-between gap-4 transition-colors hover:bg-base-soft">
        <div>
          <p className="text-sm font-medium text-ink">{title}</p>
          <p className="text-sm text-ink-muted">{text}</p>
        </div>
        <span aria-hidden="true" className="text-ink-faint">→</span>
      </Card>
    </Link>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  )
}
