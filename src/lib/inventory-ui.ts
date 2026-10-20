/**
 * Presentation helpers for the Inventory page: an emoji per ingredient, how
 * full the stock bar is, how much to buy, and the WhatsApp shopping list.
 * Pure, so they're unit-tested.
 */
import type { InventoryStatusValue } from '@/lib/calc/inventory'

const EMOJI: [RegExp, string][] = [
  [/butter|mentega|marjerin|margarine/i, '🧈'],
  [/choc|coklat|cocoa|koko/i, '🍫'],
  [/flour|tepung/i, '🌾'],
  [/egg|telur/i, '🥚'],
  [/sugar|gula/i, '🍬'],
  [/milk|susu|condensed|pekat/i, '🥛'],
  [/cream|krim/i, '🍦'],
  [/cheese|keju/i, '🧀'],
  [/biscuit|biskut|marie|oreo|biscoff/i, '🍪'],
  [/nut|kacang|almond|pistachio/i, '🥜'],
  [/matcha|tea|teh|pandan/i, '🍵'],
  [/coffee|kopi|nescafe/i, '☕'],
  [/strawberr/i, '🍓'],
  [/banana|pisang/i, '🍌'],
  [/yam|keladi|ube/i, '🍠'],
  [/honey|madu|syrup/i, '🍯'],
  [/vanilla|essence|esen|flavour|perisa/i, '🧪'],
  [/box|kotak|container|bekas|tub/i, '📦'],
  [/bag|beg|plastic|plastik/i, '🛍️'],
  [/sticker|label|ribbon|reben/i, '🏷️'],
  [/cup|cawan|spoon|sudu|fork/i, '🥄'],
]

/** A best guess from the item's name (or category), e.g. "Butter Anchor" → 🧈. */
export function ingredientEmoji(name: string, category?: string | null): string {
  const text = `${name} ${category ?? ''}`
  return EMOJI.find(([pattern]) => pattern.test(text))?.[1] ?? '🥣'
}

/**
 * How full the stock bar is, 0–100. Full at twice the reorder level, so the
 * reorder line sits halfway. With no reorder level set, anything in stock is full.
 */
export function stockFill(quantity: number, reorderLevel: number): number {
  const q = Math.max(0, Number(quantity) || 0)
  const r = Math.max(0, Number(reorderLevel) || 0)
  if (r === 0) return q > 0 ? 100 : 0
  return Math.min(100, Math.round((q / (r * 2)) * 100))
}

/** How much to buy to get back to a comfortable level (twice the reorder level), rounded up sensibly. */
export function suggestedBuy(quantity: number, reorderLevel: number): number {
  const need = Math.max(0, Number(reorderLevel) * 2 - Math.max(0, Number(quantity) || 0))
  if (need === 0) return 0
  const step = need >= 10 ? 1 : need >= 1 ? 0.5 : 0.1
  return Math.round(Math.ceil(need / step) * step * 100) / 100
}

/** Worst first, so what needs buying is at the top. */
export const STATUS_ORDER: Record<InventoryStatusValue, number> = { out_of_stock: 0, reorder: 1, low: 2, ok: 3 }

export interface ShoppingItem {
  name: string
  unit: string
  quantity: number
  reorderLevel: number
}

/** The shopping list as a WhatsApp message (to a supplier, or yourself). */
export function shoppingListMessage(items: ShoppingItem[], shopName: string): string {
  const lines = items.map((i) => {
    const amount = suggestedBuy(i.quantity, i.reorderLevel)
    return `- ${i.name}${amount > 0 ? `: ${amount} ${i.unit}` : ''}`
  })
  return [`🛒 Senarai belian — ${shopName}`, '', ...lines].join('\n')
}
