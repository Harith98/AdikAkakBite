import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { canManageBusiness } from '@/lib/team'
import { Card } from '@/components/ui/Card'

const EXPORTS = [
  { kind: 'orders', emoji: '🧾', title: 'Orders', text: 'Every order, one row per item, with dates, status and money' },
  { kind: 'customers', emoji: '👥', title: 'Customers', text: 'Names, phones, orders, total spending, last order' },
  { kind: 'products', emoji: '🧁', title: 'Products', text: 'Prices, costs, margins, ready stock, nicknames' },
  { kind: 'inventory', emoji: '📦', title: 'Inventory', text: 'What’s in stock now, reorder levels and stock value' },
  { kind: 'stock-history', emoji: '📜', title: 'Stock history', text: 'Every purchase, usage, waste and adjustment' },
]

export default async function ExportPage() {
  const { role } = await getCurrentBusinessContext()
  if (!canManageBusiness(role)) redirect('/settings')

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <Link href="/settings" className="text-sm text-ink-muted">
          ← Settings
        </Link>
        <p className="mt-2 font-display text-3xl text-ink">Export data</p>
        <p className="mt-1 text-sm text-ink-muted">Download your data as spreadsheets (CSV). Opens in Excel or Google Sheets.</p>
      </header>

      <Card className="!p-0 overflow-hidden">
        <ul className="divide-y divide-ink/5">
          {EXPORTS.map((e) => (
            <li key={e.kind}>
              {/* A plain link: the browser downloads the file the route returns. */}
              <a href={`/api/export/${e.kind}`} download className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-base-soft">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-base-soft text-xl">
                  {e.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{e.title}</span>
                  <span className="block text-xs text-ink-muted">{e.text}</span>
                </span>
                <span className="shrink-0 text-sm font-medium text-raspberry-dark">Download ↓</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="!bg-amber-soft !border-amber/50">
        <p className="text-sm font-medium text-amber-dark">💾 Keep a backup</p>
        <p className="mt-1 text-sm text-amber-dark">
          The free Supabase plan has no downloadable backups. Download all five once a month and keep them in Google Drive.
          Photos and the catalogue PDF stay online and aren&apos;t included.
        </p>
      </Card>
    </div>
  )
}
