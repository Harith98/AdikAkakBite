import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { getInventoryStatus } from '@/lib/calc/inventory'
import type { EngineInventoryAlert } from '@/lib/services/recommendation'

export function AlertsCard({ alerts }: { alerts: EngineInventoryAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Needs attention</p>
      <ul className="mt-3 flex flex-col gap-3">
        {alerts.map((item) => {
          const status = getInventoryStatus(item.currentQuantity, item.reorderLevel)
          return (
            <li key={item.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">{item.name}</p>
                <p className="text-xs text-ink-muted">
                  {item.currentQuantity} {item.unit} left · reorder at {item.reorderLevel}
                </p>
              </div>
              <Badge tone="clay">{status === 'out_of_stock' ? 'Out of stock' : '⚠️ Reorder'}</Badge>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
