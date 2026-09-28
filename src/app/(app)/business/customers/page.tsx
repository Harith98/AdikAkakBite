import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { getCustomerMetrics } from '@/lib/services/customers'
import { getBusinessNow } from '@/lib/time'
import { formatMoney } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { DataLink } from '@/components/ui/DataLink'

export default async function CustomersPage() {
  const { business, settings } = await getCurrentBusinessContext()
  const today = getBusinessNow(settings.timezone).isoDate
  const customers = await getCustomerMetrics(createClient(), business.id, today)

  const buyers = customers.filter((c) => c.numberOfOrders > 0)
  const repeat = buyers.filter((c) => c.isRepeatCustomer).length
  // Best customers first; customers with no completed order yet go last.
  const sorted = [...customers].sort((a, b) => b.totalSpending - a.totalSpending || a.name.localeCompare(b.name))

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header>
        <Link href="/business" className="text-sm text-ink-muted">← Business</Link>
        <p className="mt-2 font-display text-3xl text-ink">Customers</p>
        <p className="mt-1 text-sm text-ink-muted">Customers are added automatically when you create an order.</p>
      </header>

      {customers.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Customers" value={String(customers.length)} />
          <Stat label="Repeat customers" value={String(repeat)} />
          <Stat label="Repeat rate" value={buyers.length > 0 ? `${Math.round((repeat / buyers.length) * 100)}%` : '—'} />
        </div>
      )}

      {customers.length === 0 ? (
        <Card><p className="text-sm text-ink-muted">No customers yet. Create your first order and they&apos;ll appear here.</p></Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((c) => (
            <li key={c.customerId}>
              <DataLink href={`/business/customers/${c.customerId}`} className="block">
                <Card className="transition-colors hover:bg-base-soft">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-xl text-ink">{c.name}</p>
                    <p className="text-sm font-medium text-ink">{formatMoney(c.totalSpending, settings.currency)}</p>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {c.numberOfOrders === 0
                      ? c.openOrders > 0 ? `${c.openOrders} order in progress` : 'No completed orders yet'
                      : `${c.numberOfOrders} order${c.numberOfOrders === 1 ? '' : 's'} · last ${c.daysSinceLastOrder === 0 ? 'today' : `${c.daysSinceLastOrder} days ago`}`}
                  </p>
                  {c.isRepeatCustomer && <div className="mt-2"><Badge tone="sage">Repeat customer</Badge></div>}
                </Card>
              </DataLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-base-card p-3 shadow-card">
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
    </div>
  )
}
