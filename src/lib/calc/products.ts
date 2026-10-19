export interface ProductEconomics {
  totalCost: number
  grossProfit: number
  /** Percentage, or null when the selling price is 0 (a margin is undefined). */
  grossMargin: number | null
}

function safe(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Spec §15:
 *   total cost   = ingredient + packaging + other
 *   gross profit = selling price − total cost   (negative if the product loses money)
 *   gross margin = gross profit ÷ selling price × 100
 */
export function calculateProductEconomics(input: {
  sellingPrice: number | null | undefined
  ingredientCost: number | null | undefined
  packagingCost: number | null | undefined
  otherCost: number | null | undefined
}): ProductEconomics {
  const price = safe(input.sellingPrice)
  const totalCost = round2(safe(input.ingredientCost) + safe(input.packagingCost) + safe(input.otherCost))
  const grossProfit = round2(price - totalCost)
  return {
    totalCost,
    grossProfit,
    grossMargin: price > 0 ? round2((grossProfit / price) * 100) : null,
  }
}

export type ReadyStockState = 'untracked' | 'in_stock' | 'sold_out' | 'short'

/** How a product's ready stock reads: not tracked, some ready, none left, or oversold. */
export function readyStockState(readyStock: number | null): ReadyStockState {
  if (readyStock === null) return 'untracked'
  if (readyStock > 0) return 'in_stock'
  return readyStock === 0 ? 'sold_out' : 'short'
}

/** "12 ready" · "Sold out" · "Short by 2" · null when not tracked. */
export function readyStockLabel(readyStock: number | null): string | null {
  switch (readyStockState(readyStock)) {
    case 'in_stock':
      return `${readyStock} ready`
    case 'sold_out':
      return 'Sold out'
    case 'short':
      return `Short by ${Math.abs(readyStock ?? 0)}`
    default:
      return null
  }
}
