import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { canManageBusiness } from '@/lib/team'
import { siteUrl } from '@/lib/site-url'
import { toWhatsAppNumber } from '@/lib/receipts'
import { Card } from '@/components/ui/Card'
import { CatalogueManager } from '@/components/settings/CatalogueManager'
import { MenuLinkShare } from '@/components/settings/MenuLinkShare'

export default async function MenuSettingsPage() {
  const { business, role, settings } = await getCurrentBusinessContext()
  if (!canManageBusiness(role)) redirect('/settings')
  const updated = business.menu_pdf_updated_at
    ? new Date(business.menu_pdf_updated_at).toLocaleDateString('en-GB', {
        timeZone: settings.timezone,
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null
  const hasWhatsApp = Boolean(toWhatsAppNumber(business.phone))

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <Link href="/settings" className="text-sm text-ink-muted">
          ← Settings
        </Link>
        <p className="mt-2 font-display text-3xl text-ink">Customer menu</p>
        <p className="mt-1 text-sm text-ink-muted">
          A page for customers: your catalogue, and an order form that sends your WhatsApp template to you.
        </p>
      </header>

      {!hasWhatsApp && (
        <Card className="!border-amber/60 !bg-amber-soft">
          <p className="text-sm text-amber-dark">
            Add your WhatsApp number in{' '}
            <Link href="/settings/business" className="font-medium underline">
              Business &amp; receipt details → Phone
            </Link>{' '}
            so orders reach you.
          </p>
        </Card>
      )}

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Catalogue (PDF)</p>
        <CatalogueManager businessId={business.id} currentUrl={business.menu_pdf_url} updatedLabel={updated} />
      </Card>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Menu link</p>
        <MenuLinkShare url={`${siteUrl()}/menu`} />
      </Card>

      <p className="text-xs text-ink-muted">
        When an order arrives on WhatsApp, copy it and go to Orders → New order → Paste from WhatsApp.
      </p>
    </div>
  )
}
