import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { canManageBusiness } from '@/lib/team'
import { menuHostname, menuUrl } from '@/lib/site-url'
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/settings', label: 'Settings' }} title="Customer menu" subtitle="A page for customers: your catalogue, and an order form that sends your WhatsApp template to you." />

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
        <SectionLabel icon="📖" className="mb-3">Catalogue (PDF)</SectionLabel>
        <CatalogueManager businessId={business.id} currentUrl={business.menu_pdf_url} updatedLabel={updated} />
      </Card>

      <Card>
        <SectionLabel icon="🔗" className="mb-3">Menu link</SectionLabel>
        <MenuLinkShare url={menuUrl()} />
        {menuHostname() ? (
          <p className="mt-3 text-xs text-sage-dark">
            🔒 The menu has its own address, so customers never see the app&apos;s. Any page on it shows only the menu.
          </p>
        ) : (
          <div className="mt-3 rounded-card bg-amber-soft p-3 text-xs text-amber-dark">
            <p className="font-medium">Tip: give the menu its own address</p>
            <p className="mt-1">
              Right now the menu is on the app&apos;s address. In Vercel → Settings → Domains, add e.g.{' '}
              <span className="font-mono">adikakak-menu.vercel.app</span>, then set{' '}
              <span className="font-mono">NEXT_PUBLIC_MENU_URL</span> to it in Environment Variables and redeploy. Customers
              then only ever see the menu.
            </p>
          </div>
        )}
      </Card>

      <p className="text-xs text-ink-muted">
        When an order arrives on WhatsApp, copy it and go to Orders → New order → Paste from WhatsApp.
      </p>
    </div>
  )
}
