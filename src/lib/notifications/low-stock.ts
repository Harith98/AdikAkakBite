/**
 * Low-stock alerts for changes that touch many items at once (recipe usage
 * when a batch is made or an order completes). Take a snapshot before and
 * after; anything that newly crossed into Reorder / Out of stock is pushed.
 */
import { getInventoryStatus } from '@/lib/calc/inventory'
import { lowStockMessage, shouldAlertLowStock } from './messages'
import { notifyTeam } from './push'

export interface StockSnapshotItem {
  id: string
  name: string
  unit: string
  current_quantity: number
  reorder_level: number
}

export type StockSnapshot = Map<string, StockSnapshotItem>

/** Inventory is a small table for a small business, so the whole of it is cheap to snapshot. */
export async function snapshotStock(supabase: any, businessId: string): Promise<StockSnapshot> {
  const { data } = await supabase
    .from('inventory_items')
    .select('id, name, unit, current_quantity, reorder_level')
    .eq('business_id', businessId)
  return new Map(((data ?? []) as StockSnapshotItem[]).map((i) => [i.id, i]))
}

export async function alertNewlyLowStock(businessId: string, before: StockSnapshot, after: StockSnapshot): Promise<void> {
  const messages = []
  for (const [id, now] of Array.from(after)) {
    const was = before.get(id)
    if (!was) continue
    const statusBefore = getInventoryStatus(Number(was.current_quantity), Number(was.reorder_level))
    const statusNow = getInventoryStatus(Number(now.current_quantity), Number(now.reorder_level))
    if (shouldAlertLowStock(statusBefore, statusNow)) {
      messages.push(
        lowStockMessage({
          id,
          name: now.name,
          unit: now.unit,
          currentQuantity: Number(now.current_quantity),
          reorderLevel: Number(now.reorder_level),
          status: statusNow,
        })
      )
    }
  }
  if (messages.length > 0) await notifyTeam(businessId, 'low_stock', messages)
}
