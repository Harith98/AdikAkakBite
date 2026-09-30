import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { InventoryStatusBadge } from '@/components/business/InventoryStatusBadge'
import { getInventoryStatus } from '@/lib/calc/inventory'
import type { EngineInventoryAlert } from '@/lib/services/recommendation'

export function AlertsCard({ alerts }: { alerts: EngineInventoryAlert[] }) {
  if (alerts.length === 0) return null
  // Out of stock first, then whatever is furthest below its reorder level.
  const rows = alerts
    .map((item) => ({ item, status: getInventoryStatus(item.currentQuantity, item.reorderLevel) }))
    .sort(
      (a, b) =>
        Number(b.status === 'out_of_stock') - Number(a.status === 'out_of_stock') ||
        a.item.currentQuantity / (a.item.reorderLevel || 1) - b.item.currentQuantity / (b.item.reorderLevel || 1)
    )

  return (
    <Card className="!border-clay/40 !border-l-4 !border-l-clay !bg-clay-soft/50">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-clay-dark">
          Needs attention · {alerts.length} item{alerts.length === 1 ? '' : 's'}
        </p>
        <Link href="/business/inventory" className="text-xs font-medium text-clay-dark underline-offset-2 hover:underline">
          Inventory →
        </Link>
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-clay/15">
        {rows.map(({ item, status }) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <Link href={`/business/inventory/${item.id}`} className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{item.name}</p>
              <p className="text-xs text-ink-muted">
                <span className={status === 'out_of_stock' ? 'font-medium text-clay-dark' : undefined}>
                  {item.currentQuantity} {item.unit} left
                </span>{' '}
                · reorder at {item.reorderLevel}
              </p>
            </Link>
            <InventoryStatusBadge status={status} />
          </li>
        ))}
      </ul>
    </Card>
  )
}
