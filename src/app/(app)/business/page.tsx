import Link from 'next/link'
import { Card } from '@/components/ui/Card'

const AVAILABLE = [
  { href: '/business/sales', title: 'Sales', text: 'Today, this week and this month, plus your daily close' },
  { href: '/business/products', title: 'Products', text: 'Prices, costs, profit and margin for everything you sell' },
  { href: '/business/inventory', title: 'Inventory', text: 'Stock levels, reorder alerts, usage and waste' },
  { href: '/business/customers', title: 'Customers', text: 'Who buys, how much, and who has come back' },
]

const COMING = [
  { title: 'Dashboard & goals', phase: 'Phase 5', text: 'Trends, comparisons, top products and goal progress' },
  { title: 'Forecasts', phase: 'Phase 6', text: 'Estimated sales, busy days and stock running out' },
]

export default function BusinessPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <p className="font-display text-3xl text-ink">Business</p>
        <p className="mt-1 text-sm text-ink-muted">The numbers behind your dessert business</p>
      </header>

      <div className="flex flex-col gap-3">
        {AVAILABLE.map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <Card className="flex items-center justify-between gap-4 transition-colors hover:bg-base-soft">
              <div>
                <p className="text-lg font-medium text-ink">{item.title}</p>
                <p className="text-sm text-ink-muted">{item.text}</p>
              </div>
              <span aria-hidden="true" className="text-ink-faint">→</span>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Coming soon</p>
        <ul className="flex flex-col gap-2">
          {COMING.map((item) => (
            <li key={item.title} className="rounded-card border border-dashed border-ink/15 px-4 py-3">
              <p className="text-sm font-medium text-ink">
                {item.title} <span className="font-normal text-ink-faint">· {item.phase}</span>
              </p>
              <p className="text-sm text-ink-muted">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
