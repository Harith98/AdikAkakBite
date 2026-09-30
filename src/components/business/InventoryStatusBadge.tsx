import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { InventoryStatusValue } from '@/lib/calc/inventory'

/** One step up in colour per step in severity: OK → Low → Reorder → Out of stock. */
export const INVENTORY_STATUS_STYLE: Record<InventoryStatusValue, { label: string; tone: BadgeTone }> = {
  ok: { label: 'OK', tone: 'sage' },
  low: { label: 'Low', tone: 'amber' },
  reorder: { label: 'Reorder', tone: 'clay' },
  out_of_stock: { label: 'Out of stock', tone: 'clay-solid' },
}

export function InventoryStatusBadge({ status }: { status: InventoryStatusValue }) {
  const s = INVENTORY_STATUS_STYLE[status]
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  )
}
