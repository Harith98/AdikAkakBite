export type InventoryStatusValue = 'ok' | 'low' | 'reorder' | 'out_of_stock'

/**
 * "Low" means stock is above the reorder level but within 50% of it — an
 * early warning before it becomes a reorder. This buffer is a V1 default
 * (the spec names the four statuses but not the "low" threshold); it is a
 * single constant so it can become a setting later.
 */
export const LOW_STOCK_BUFFER = 1.5

export function getInventoryStatus(currentQuantity: number, reorderLevel: number): InventoryStatusValue {
  const quantity = Number.isFinite(currentQuantity) ? currentQuantity : 0
  const reorder = Number.isFinite(reorderLevel) && reorderLevel > 0 ? reorderLevel : 0
  if (quantity <= 0) return 'out_of_stock'
  if (quantity <= reorder) return 'reorder' // spec §17: quantity <= reorder level → REORDER
  if (quantity <= reorder * LOW_STOCK_BUFFER) return 'low'
  return 'ok'
}

export function needsReorder(status: InventoryStatusValue): boolean {
  return status === 'reorder' || status === 'out_of_stock'
}
