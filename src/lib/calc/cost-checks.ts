import { recipeCostPerUnit } from './recipes'

/**
 * Has an ingredient's price changed since a product's cost was last set?
 *
 * A product's saved ingredient cost is dated (product_costs), so sales always
 * use the cost they had at the time. But when an ingredient's price changes,
 * the products using it keep their old saved cost until it's updated, so
 * profit from then on would use a cost that's no longer true. This finds them.
 */

export interface CostCheckProduct {
  id: string
  name: string
  category: string | null
  recipeYield: number
  /** The ingredient cost saved on the product now (per unit). */
  savedIngredientCost: number
}

export interface CostCheckLine {
  productId: string
  inventoryItemId: string
  /** Amount one batch uses, in the item's unit. */
  quantity: number
  /** The ingredient's price per unit today. */
  unitCost: number
}

export interface RecipeCostCheck {
  productId: string
  name: string
  category: string | null
  /** Saved on the product (what profit uses now). */
  savedCost: number
  /** What the recipe costs at today's ingredient prices. */
  recipeCost: number
  /** True when they differ by a sen or more. */
  outdated: boolean
  /** Inventory items the recipe uses. */
  itemIds: string[]
}

/** One check per product that has a recipe; products without one are left out. */
export function checkRecipeCosts(products: CostCheckProduct[], lines: CostCheckLine[]): RecipeCostCheck[] {
  const byProduct = new Map<string, CostCheckLine[]>()
  for (const line of lines) byProduct.set(line.productId, [...(byProduct.get(line.productId) ?? []), line])

  return products
    .filter((p) => (byProduct.get(p.id) ?? []).length > 0)
    .map((p) => {
      const recipe = byProduct.get(p.id)!
      const recipeCost = recipeCostPerUnit(
        recipe.map((l) => ({ quantity: l.quantity, unitCost: l.unitCost, currentQuantity: 0 })),
        p.recipeYield
      )
      const savedCost = Math.round(p.savedIngredientCost * 100) / 100
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        savedCost,
        recipeCost,
        outdated: Math.abs(recipeCost - savedCost) >= 0.01,
        itemIds: Array.from(new Set(recipe.map((l) => l.inventoryItemId))),
      }
    })
    .sort((a, b) => Number(b.outdated) - Number(a.outdated) || a.name.localeCompare(b.name))
}
