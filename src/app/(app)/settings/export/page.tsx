import { PageHeader } from '@/components/ui/PageHeader'
import { redirect } from 'next/navigation'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { canManageBusiness } from '@/lib/team'
import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { getBusinessNow } from '@/lib/time'

const EXPORTS = [
  { kind: 'orders', emoji: '🧾', title: 'Orders', text: 'Every order, one row per item, with dates, status and money' },
  { kind: 'customers', emoji: '👥', title: 'Customers', text: 'Names, phones, orders, total spending, last order' },
  { kind: 'products', emoji: '🧁', title: 'Products', text: 'Prices, costs, margins, ready stock, nicknames' },
  { kind: 'inventory', emoji: '📦', title: 'Inventory', text: 'What’s in stock now, reorder levels and stock value' },
  { kind: 'stock-history', emoji: '📜', title: 'Stock history', text: 'Every purchase, usage, waste and adjustment' },
]

const dateInput = 'h-11 w-full rounded-card border border-ink/15 bg-base-soft px-3 text-sm text-ink'
const reportButton =
  'flex w-full items-center gap-3 rounded-card border border-raspberry/15 bg-base-card px-3 py-2.5 text-left shadow-card transition-colors hover:bg-base-soft'

export default async function ExportPage() {
  const { role, settings } = await getCurrentBusinessContext()
  if (!canManageBusiness(role)) redirect('/settings')
  const today = getBusinessNow(settings.timezone).isoDate

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader back={{ href: '/settings', label: 'Settings' }} title="Export data" subtitle="Download your data as spreadsheets (CSV). Opens in Excel or Google Sheets." />

      <Card>
        <SectionLabel icon="💰">Money reports</SectionLabel>
        <p className="mt-1 text-sm text-ink-muted">
          Sales count on the day an order was completed. Costs are each product&apos;s cost on the day of the sale.
        </p>
        {/* A plain GET form: each button downloads its report for the chosen dates. */}
        <form method="get" action="/api/export/finance-summary" className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">From</span>
              <input type="date" name="from" required defaultValue={`${today.slice(0, 4)}-01-01`} max={today} className={dateInput} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-muted">To</span>
              <input type="date" name="to" required defaultValue={today} max={today} className={dateInput} />
            </label>
          </div>
          <button type="submit" formAction="/api/export/finance-summary" className={reportButton}>
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-sage-soft text-xl">
              📊
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Monthly summary</span>
              <span className="block text-xs text-ink-muted">One row per month: sales, costs, gross profit, overheads, net profit</span>
            </span>
            <span className="shrink-0 text-sm font-medium text-raspberry-dark">Download ↓</span>
          </button>
          <button type="submit" formAction="/api/export/sales-detail" className={reportButton}>
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-amber-soft text-xl">
              🔎
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Sales detail (to check the numbers)</span>
              <span className="block text-xs text-ink-muted">Every item sold, with its sale date, customer, price and the cost used. Its TOTAL row matches the summary.</span>
            </span>
            <span className="shrink-0 text-sm font-medium text-raspberry-dark">Download ↓</span>
          </button>
          <button type="submit" formAction="/api/export/expenses" className={reportButton}>
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-base-soft text-xl">
              🧾
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Expenses</span>
              <span className="block text-xs text-ink-muted">Every overhead (monthly ones once per month). Its TOTAL row matches the summary&apos;s Overheads.</span>
            </span>
            <span className="shrink-0 text-sm font-medium text-raspberry-dark">Download ↓</span>
          </button>
        </form>
      </Card>

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
          The free Supabase plan has no downloadable backups. Download the five lists above once a month and keep them in Google Drive.
          Photos and the catalogue PDF stay online and aren&apos;t included.
        </p>
      </Card>
    </div>
  )
}
