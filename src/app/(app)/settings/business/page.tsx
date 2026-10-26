import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { canManageBusiness } from '@/lib/team'
import { Card } from '@/components/ui/Card'
import { BusinessDetailsForm } from '@/components/settings/BusinessDetailsForm'

const WEEKDAY_LABELS: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' }

export default async function BusinessDetailsPage() {
  const { business, settings, role } = await getCurrentBusinessContext()
  const canEdit = canManageBusiness(role)
  const workingDays = settings.working_days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ')

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/settings', label: 'Settings' }} title="Business details" subtitle="Shown at the top of every receipt you generate." />

      <Card>
        {canEdit ? (
          <BusinessDetailsForm
            details={{
              name: business.name,
              ownerName: business.owner_name,
              phone: business.phone,
              email: business.email,
              address: business.address,
              registrationNumber: business.registration_number,
              receiptFooter: business.receipt_footer,
              instagramUrl: business.instagram_url ?? null,
              facebookUrl: business.facebook_url ?? null,
              tiktokUrl: business.tiktok_url ?? null,
              threadsUrl: business.threads_url ?? null,
            }}
          />
        ) : (
          <dl className="flex flex-col gap-3 text-sm">
            <Row label="Name" value={business.name} />
            <Row label="Owner" value={business.owner_name ?? '—'} />
            <Row label="Phone" value={business.phone ?? '—'} />
            <Row label="Email" value={business.email ?? '—'} />
            <Row label="Address" value={business.address ?? '—'} />
            <p className="text-xs text-ink-muted">Only the owner or an admin can change these.</p>
          </dl>
        )}
      </Card>

      <Card>
        <SectionLabel icon="🕘" className="mb-3">Hours &amp; region</SectionLabel>
        <dl className="flex flex-col gap-3 text-sm">
          <Row label="Working days" value={workingDays} />
          <Row label="Working hours" value={`${settings.working_hours_start.slice(0, 5)} – ${settings.working_hours_end.slice(0, 5)}`} />
          <Row label="Currency" value={settings.currency} />
          <Row label="Timezone" value={settings.timezone} />
        </dl>
        <p className="mt-3 text-xs text-ink-muted">Set during first-time setup.</p>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  )
}
