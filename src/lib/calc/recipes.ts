/**
 * Recipe maths. Amounts are per BATCH, in each inventory item's own unit;
 * `yield` is how many units of the product one batch makes.
 */

export interface RecipeLine {
  /** Amount one batch uses, in the item's unit. */
  quantity: number
  /** Inventory item's cost per unit (e.g. per kg). */
  unitCost: number
  /** How much of the item is in stock now, in its unit. */
  currentQuantity: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const safeYield = (y: number) => (Number.isFinite(y) && y > 0 ? y : 1)

/** Ingredient cost of ONE unit of the product. */
export function recipeCostPerUnit(lines: RecipeLine[], recipeYield: number): number {
  const batch = lines.reduce((sum, l) => sum + Math.max(0, l.quantity) * Math.max(0, l.unitCost), 0)
  return round2(batch / safeYield(recipeYield))
}

/** Ingredient cost of one whole batch. */
export function recipeCostPerBatch(lines: RecipeLine[]): number {
  return round2(lines.reduce((sum, l) => sum + Math.max(0, l.quantity) * Math.max(0, l.unitCost), 0))
}

/**
 * How many units could be made from what's in stock now — limited by the
 * scarcest ingredient. Null when the recipe has no ingredients.
 */
export function unitsMakeable(lines: RecipeLine[], recipeYield: number): number | null {
  const used = lines.filter((l) => l.quantity > 0)
  if (used.length === 0) return null
  const perUnit = (l: RecipeLine) => l.quantity / safeYield(recipeYield)
  return Math.max(0, Math.floor(Math.min(...used.map((l) => Math.max(0, l.currentQuantity) / perUnit(l))) + 1e-9))
}

/** The ingredient that runs out first, by index into `lines`, or null. */
export function limitingIngredient(lines: RecipeLine[]): number | null {
  let best: number | null = null
  let bestBatches = Infinity
  lines.forEach((l, i) => {
    if (l.quantity <= 0) return
    const batches = Math.max(0, l.currentQuantity) / l.quantity
    if (batches < bestBatches) {
      bestBatches = batches
      best = i
    }
  })
  return best
}
