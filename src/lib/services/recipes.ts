import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

export interface RecipeLineView {
  inventoryItemId: string
  name: string
  unit: string
  unitCost: number
  currentQuantity: number
  /** Amount one batch uses, in the item's unit. */
  quantity: number
}

export interface IngredientOption {
  id: string
  name: string
  unit: string
  unitCost: number
  currentQuantity: number
}

export interface RecipeView {
  recipeYield: number
  lines: RecipeLineView[]
  /** Every inventory item, for adding to the recipe. */
  ingredients: IngredientOption[]
}

/** A product's recipe plus the inventory items it can use, in one round trip each (run in parallel). */
export async function getRecipe(supabase: Client, businessId: string, productId: string): Promise<RecipeView> {
  const [productRes, linesRes, itemsRes] = await Promise.all([
    supabase.from('products').select('recipe_yield').eq('id', productId).eq('business_id', businessId).maybeSingle(),
    supabase
      .from('product_recipe_items')
      .select('inventory_item_id, quantity, item:inventory_items(name, unit, unit_cost, current_quantity)')
      .eq('product_id', productId)
      .order('created_at', { ascending: true }),
    supabase
      .from('inventory_items')
      .select('id, name, unit, unit_cost, current_quantity')
      .eq('business_id', businessId)
      .order('name', { ascending: true }),
  ])
  if (linesRes.error) throw new Error(`Could not load the recipe: ${linesRes.error.message}`)
  if (itemsRes.error) throw new Error(`Could not load inventory: ${itemsRes.error.message}`)

  type Joined = { name: string; unit: string; unit_cost: number; current_quantity: number }
  const lines = ((linesRes.data ?? []) as unknown as { inventory_item_id: string; quantity: number; item: Joined | Joined[] | null }[])
    .map((row) => {
      const item = Array.isArray(row.item) ? row.item[0] : row.item
      if (!item) return null
      return {
        inventoryItemId: row.inventory_item_id,
        name: item.name,
        unit: item.unit,
        unitCost: Number(item.unit_cost),
        currentQuantity: Number(item.current_quantity),
        quantity: Number(row.quantity),
      }
    })
    .filter((l): l is RecipeLineView => l !== null)

  return {
    recipeYield: (productRes.data as { recipe_yield: number } | null)?.recipe_yield ?? 1,
    lines,
    ingredients: (itemsRes.data ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      unitCost: Number(i.unit_cost),
      currentQuantity: Number(i.current_quantity),
    })),
  }
}
