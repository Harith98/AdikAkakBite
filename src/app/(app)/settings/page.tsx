import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { canManageBusiness, ROLE_LABELS } from '@/lib/team'
import { signOut } from './actions'

/** How Settings is grouped: the business (shop and team), and the app (alerts, data, health). */
const GROUPS: { title: string; hrefs: string[] }[] = [
  { title: 'Business', hrefs: ['/settings/business', '/settings/menu', '/settings/team', '/settings/schedule'] },
  { title: 'App', hrefs: ['/settings/notifications', '/settings/export', '/settings/system'] },
]

interface SettingsRow {
  href: string
  title: string
  text: string
  tone: string
  icon: ReactNode
}

export default async function SettingsPage() {
  const { business, role, displayName, userEmail, avatarUrl } = await getCurrentBusinessContext()
  const manager = canManageBusiness(role)

  const businessRows: SettingsRow[] = [
    {
      href: '/settings/business',
      title: 'Business & receipt details',
      text: business.name,
      tone: 'bg-raspberry-soft text-raspberry-dark',
      icon: (
        <>
          <path d="M4 10v10h16V10" />
          <path d="M3 10l2-6h14l2 6H3z" />
          <path d="M10 20v-5h4v5" />
        </>
      ),
    },
    {
      href: '/settings/team',
      title: 'Team',
      text: manager ? 'Add people and manage access' : 'See who is on the team',
      tone: 'bg-clay-soft text-clay-dark',
      icon: (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <circle cx="17.5" cy="9" r="2.5" />
          <path d="M16.5 14.2A5 5 0 0 1 21.5 19" />
        </>
      ),
    },
    ...(manager
      ? [
          {
            href: '/settings/menu',
            title: 'Customer menu',
            text: business.menu_pdf_url ? 'Catalogue PDF and order link' : 'Upload your catalogue PDF',
            tone: 'bg-amber-soft text-amber-dark',
            icon: (
              <>
                <path d="M6 3h9l4 4v14H6z" />
                <path d="M15 3v4h4M9 12h7M9 16h5" />
              </>
            ),
          },
          {
            href: '/settings/export',
            title: 'Export data',
            text: 'Download orders, customers and more as spreadsheets',
            tone: 'bg-sage-soft text-sage-dark',
            icon: (
              <>
                <path d="M12 3v12M7 10l5 5 5-5" />
                <path d="M4 17v3h16v-3" />
              </>
            ),
          },
          {
            href: '/settings/schedule',
            title: 'Daily schedule',
            text: 'Blocks and tasks that shape your day',
            tone: 'bg-sage-soft text-sage-dark',
            icon: (
              <>
                <rect x="3.5" y="5" width="17" height="15" rx="2" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
              </>
            ),
          },
        ]
      : []),
  ]

  const appRows: SettingsRow[] = [
    {
      href: '/settings/notifications',
      title: 'Notifications',
      text: 'Low stock, orders, schedule and posting reminders',
      tone: 'bg-amber-soft text-amber-dark',
      icon: (
        <>
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
          <path d="M10 20.5a2 2 0 0 0 4 0" />
        </>
      ),
    },
    ...(role === 'owner'
      ? [
          {
            href: '/settings/system',
            title: 'System status',
            text: 'Supabase & Vercel limits, setup checks, fixes',
            tone: 'bg-ink/5 text-ink-muted',
            icon: (
              <>
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4M7 10h2l1.5-2.5L13 12l1.5-2H17" />
              </>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader title="Settings" />

      {/* Who's signed in; name, email and password are edited on the account page. */}
      <Link href="/settings/account" className="block">
        <Card className="flex items-center gap-4 transition-colors hover:bg-base-soft">
          <Avatar url={avatarUrl} name={displayName ?? userEmail ?? '?'} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink">{displayName ?? 'Add your name'}</span>
            <span className="block truncate text-sm text-ink-muted">
              {ROLE_LABELS[role]}
              {userEmail ? ` · ${userEmail}` : ''}
            </span>
          </span>
          <span aria-hidden="true" className="text-ink-faint">
            →
          </span>
        </Card>
      </Link>

      {GROUPS.map((group) => {
        // Rows a person can't use (e.g. staff and Export) aren't defined, so a group may end up empty and is skipped.
        const rows = group.hrefs
          .map((href) => [...businessRows, ...appRows].find((row) => row.href === href))
          .filter((row): row is SettingsRow => row !== undefined)
        return rows.length > 0 ? <Group key={group.title} title={group.title} rows={rows} /> : null
      })}

      <form action={signOut}>
        <Button type="submit" variant="secondary" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  )
}

/** A labelled group of rows in one card, like a phone's settings screen. */
function Group({ title, rows }: { title: string; rows: SettingsRow[] }) {
  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-faint">{title}</p>
      <Card className="overflow-hidden !p-0">
        <ul className="divide-y divide-ink/5">
          {rows.map((row) => (
            <li key={row.href}>
              <Link href={row.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-base-soft">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card ${row.tone}`}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {row.icon}
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{row.title}</span>
                  <span className="block truncate text-xs text-ink-muted">{row.text}</span>
                </span>
                <span aria-hidden="true" className="text-ink-faint">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
