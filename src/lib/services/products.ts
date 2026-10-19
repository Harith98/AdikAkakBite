import type { Database } from '@/lib/supabase/database.types'
import { calculateProductEconomics, type ProductEconomics } from '@/lib/calc/products'
import { categorySuggestions } from '@/lib/product-filters'

type Client = any
type ProductRow = Database['public']['Tables']['products']['Row']
type CostRow = Database['public']['Tables']['product_costs']['Row']

export interface ProductView extends ProductEconomics {
  id: string
  name: string
  category: string | null
  description: string | null
  sellingPrice: number
  imageUrl: string | null
  isActive: boolean
  notes: string | null
  ingredientCost: number
  packagingCost: number
  otherCost: number
  /** id of the cost row currently in effect, if any. */
  currentCostId: string | null
  /** Finished units on hand; null = not tracked. Can be negative (sold more than recorded). */
  readyStock: number | null
}

/**
 * The cost row in effect is the one with no end date. If a failed edit ever
 * left two, the most recently started one wins.
 */
function pickCurrentCost(costs: CostRow[]): CostRow | undefined {
  return costs
    .filter((c) => c.effective_to === null)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
}

function toView(product: ProductRow, cost: CostRow | undefined): ProductView {
  const ingredientCost = cost?.ingredient_cost ?? 0
  const packagingCost = cost?.packaging_cost ?? 0
  const otherCost = cost?.other_cost ?? 0
  return {
    ...calculateProductEconomics({ sellingPrice: product.selling_price, ingredientCost, packagingCost, otherCost }),
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    sellingPrice: product.selling_price,
    imageUrl: product.image_url,
    isActive: product.is_active,
    notes: product.notes,
    ingredientCost,
    packagingCost,
    otherCost,
    currentCostId: cost?.id ?? null,
    readyStock: product.ready_stock ?? null,
  }
}

export async function getProducts(supabase: Client, businessId: string): Promise<ProductView[]> {
  // Current costs embedded (filtered to effective_to is null) — one round trip.
  const { data, error } = await supabase
    .from('products')
    .select('*, product_costs(*)')
    .eq('business_id', businessId)
    .is('product_costs.effective_to', null)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw new Error(`Could not load products: ${error.message}`)
  const products = (data ?? []) as (ProductRow & { product_costs: CostRow[] | null })[]
  return products.map((p) => toView(p, pickCurrentCost(p.product_costs ?? [])))
}

export async function getProduct(supabase: Client, businessId: string, productId: string): Promise<ProductView | null> {
  // Fetch the product and its cost history together instead of waiting for
  // the product to come back before asking for costs — they don't depend
  // on each other, so there's no reason to pay for two round trips in a row.
  const [
    { data, error },
    { data: costs, error: costError },
  ] = await Promise.all([
    supabase.from('products').select('*').eq('business_id', businessId).eq('id', productId).maybeSingle(),
    supabase.from('product_costs').select('*').eq('product_id', productId).is('effective_to', null),
  ])
  if (error) throw new Error(`Could not load the product: ${error.message}`)
  if (!data) return null
  if (costError) throw new Error(`Could not load the product's costs: ${costError.message}`)
  return toView(data, pickCurrentCost(costs ?? []))
}

/** Existing category names (one spelling each), to suggest in the product form. */
export async function getProductCategories(supabase: Client, businessId: string): Promise<string[]> {
  const { data, error } = await supabase.from('products').select('category').eq('business_id', businessId).not('category', 'is', null)
  if (error) return []
  return categorySuggestions((data ?? []) as { category: string | null }[])
}

export interface ReadyStockItem {
  id: string
  name: string
  /** Shown under the name, so two products with the same name can be told apart. */
  category: string | null
  imageUrl: string | null
  readyStock: number
}

/** Active products whose ready stock is tracked: in stock first (most first), then sold out / short. */
export async function getReadyStock(supabase: Client, businessId: string): Promise<ReadyStockItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, image_url, ready_stock')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('ready_stock', 'is', null)
  if (error) throw new Error(`Could not load ready stock: ${error.message}`)
  return sortReadyStock(
    ((data ?? []) as { id: string; name: string; category: string | null; image_url: string | null; ready_stock: number }[]).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      imageUrl: p.image_url,
      readyStock: p.ready_stock,
    }))
  )
}

/** In stock first (most first, then by name), then sold out / short (by name). */
export function sortReadyStock<T extends { name: string; readyStock: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aIn = a.readyStock > 0 ? 1 : 0
    const bIn = b.readyStock > 0 ? 1 : 0
    return bIn - aIn || (aIn ? b.readyStock - a.readyStock : 0) || a.name.localeCompare(b.name)
  })
}
