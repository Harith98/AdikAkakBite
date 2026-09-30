import { Badge } from '@/components/ui/Badge'
import type { InventoryStatusValue } from '@/lib/calc/inventory'

const STYLE: Record<InventoryStatusValue, { label: string; tone: 'sage' | 'amber' | 'clay' }> = {
  ok: { label: 'OK', tone: 'sage' },
  low: { label: 'Low', tone: 'amber' },
  reorder: { label: '⚠️ Reorder', tone: 'clay' },
  out_of_stock: { label: 'Out of stock', tone: 'clay' },
}

export function InventoryStatusBadge({ status }: { status: InventoryStatusValue }) {
  const s = STYLE[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}
