import { checkRecipeCosts, type RecipeCostCheck } from '@/lib/calc/cost-checks'
import { fetchAllPages, one } from './db-helpers'

type Client = any

/**
 * Every product with a recipe, its saved ingredient cost and what the recipe
 * costs at today's ingredient prices (see checkRecipeCosts). Pass a productId
 * to check just that one.
 */
export async function getRecipeCostChecks(supabase: Client, businessId: string, productId?: string): Promise<RecipeCostCheck[]> {
  type LineRow = { product_id: string; inventory_item_id: string; quantity: number; item: { unit_cost: number } | { unit_cost: number }[] | null }
  const lines = await fetchAllPages<LineRow>((from, to) => {
    let q = supabase.from('product_recipe_items').select('product_id, inventory_item_id, quantity, item:inventory_items(unit_cost)')
    if (productId) q = q.eq('product_id', productId)
    return q.order('id').range(from, to)
  }).catch((e: Error) => {
    throw new Error(`Could not load recipes: ${e.message}`)
  })

  const ids = Array.from(new Set(lines.map((l) => l.product_id)))
  const products: { id: string; name: string; category: string | null; recipe_yield: number }[] = []
  const costs = new Map<string, { ingredient_cost: number; effective_from: string }>()
  for (let i = 0; i < ids.length; i += 100) {
    const group = ids.slice(i, i + 100)
    const [productsRes, costsRes] = await Promise.all([
      supabase.from('products').select('id, name, category, recipe_yield').eq('business_id', businessId).in('id', group),
      supabase.from('product_costs').select('product_id, ingredient_cost, effective_from').in('product_id', group).is('effective_to', null),
    ])
    if (productsRes.error) throw new Error(`Could not load products: ${productsRes.error.message}`)
    if (costsRes.error) throw new Error(`Could not load product costs: ${costsRes.error.message}`)
    products.push(...(productsRes.data ?? []))
    // The cost in effect: the open one (the newest if a failed edit ever left two).
    for (const c of (costsRes.data ?? []) as { product_id: string; ingredient_cost: number; effective_from: string }[]) {
      const existing = costs.get(c.product_id)
      if (!existing || c.effective_from > existing.effective_from) costs.set(c.product_id, c)
    }
  }

  return checkRecipeCosts(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      recipeYield: Number(p.recipe_yield) || 1,
      savedIngredientCost: Number(costs.get(p.id)?.ingredient_cost ?? 0),
    })),
    lines.map((l) => ({
      productId: l.product_id,
      inventoryItemId: l.inventory_item_id,
      quantity: Number(l.quantity),
      unitCost: Number(one(l.item)?.unit_cost ?? 0),
    }))
  )
}

export interface CostPeriodRow {
  id: string
  ingredientCost: number
  packagingCost: number
  otherCost: number
  total: number
  effectiveFrom: string
  effectiveTo: string | null
}

/** A product's cost over time, newest first: each sale used the one in effect on its day. */
export async function getCostHistory(supabase: Client, productId: string): Promise<CostPeriodRow[]> {
  const { data, error } = await supabase
    .from('product_costs')
    .select('id, ingredient_cost, packaging_cost, other_cost, effective_from, effective_to')
    .eq('product_id', productId)
    .order('effective_from', { ascending: false })
    .limit(50)
  if (error) throw new Error(`Could not load cost history: ${error.message}`)
  return (data ?? []).map(
    (c: { id: string; ingredient_cost: number; packaging_cost: number; other_cost: number; effective_from: string; effective_to: string | null }) => {
      const ingredientCost = Number(c.ingredient_cost)
      const packagingCost = Number(c.packaging_cost)
      const otherCost = Number(c.other_cost)
      return {
        id: c.id,
        ingredientCost,
        packagingCost,
        otherCost,
        total: Math.round((ingredientCost + packagingCost + otherCost) * 100) / 100,
        effectiveFrom: c.effective_from,
        effectiveTo: c.effective_to,
      }
    }
  )
}
