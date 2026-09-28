import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { calculateProductEconomics, type ProductEconomics } from '@/lib/calc/products'
import { selectInChunks } from './db-helpers'

type Client = SupabaseClient<Database>
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
  }
}

export async function getProducts(supabase: Client, businessId: string): Promise<ProductView[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw new Error(`Could not load products: ${error.message}`)
  const products = data ?? []

  const costs = await selectInChunks(
    products.map((p) => p.id),
    (ids) => supabase.from('product_costs').select('*').in('product_id', ids).is('effective_to', null)
  )
  return products.map((p) => toView(p, pickCurrentCost(costs.filter((c) => c.product_id === p.id))))
}

export async function getProduct(supabase: Client, businessId: string, productId: string): Promise<ProductView | null> {
  const { data, error } = await supabase.from('products').select('*').eq('business_id', businessId).eq('id', productId).maybeSingle()
  if (error) throw new Error(`Could not load the product: ${error.message}`)
  if (!data) return null
  const { data: costs, error: costError } = await supabase.from('product_costs').select('*').eq('product_id', productId).is('effective_to', null)
  if (costError) throw new Error(`Could not load the product's costs: ${costError.message}`)
  return toView(data, pickCurrentCost(costs ?? []))
}
