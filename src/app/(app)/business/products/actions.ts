'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/supabase/database.types'
import { getActionContext } from '@/lib/services/action-context'
import { parseProductForm } from '@/lib/validation/products'

export interface SaveProductState {
  error: string | null
  nonce: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Create or update a product. Costs live in `product_costs` with a start/end
 * date, so changing a cost never rewrites the past: the new cost is added and
 * the old one is closed off.
 */
export async function saveProduct(_prev: SaveProductState, formData: FormData): Promise<SaveProductState> {
  const parsed = parseProductForm(formData)
  if (!parsed.ok) return { error: parsed.error, nonce: 0 }
  const p = parsed.value

  const idRaw = String(formData.get('productId') ?? '')
  if (idRaw && !UUID.test(idRaw)) return { error: 'Invalid product.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const { supabase, businessId, userId } = ctx

  const productFields = {
    name: p.name,
    category: p.category,
    description: p.description,
    selling_price: p.sellingPrice,
    image_url: p.imageUrl,
    is_active: p.isActive,
    notes: p.notes,
  }
  const costFields = { ingredient_cost: p.ingredientCost, packaging_cost: p.packagingCost, other_cost: p.otherCost }

  if (!idRaw) {
    const id = crypto.randomUUID()
    const productInsert: Database['public']['Tables']['products']['Insert'] = {
      id,
      business_id: businessId,
      ...productFields,
    }
    const { error } = await supabase.from('products').insert(productInsert)
    if (error) return { error: error.message, nonce: 0 }
    const costInsert: Database['public']['Tables']['product_costs']['Insert'] = { product_id: id, ...costFields }
    const { error: costError } = await supabase.from('product_costs').insert(costInsert)
    if (costError) {
      await supabase.from('products').delete().eq('id', id).eq('business_id', businessId)
      return { error: costError.message, nonce: 0 }
    }
    await supabase.from('business_activity_logs').insert({
      business_id: businessId, user_id: userId, action: 'product_created', entity_type: 'product', entity_id: id,
    })
    revalidatePath('/business', 'layout')
    redirect('/business/products')
  }

  const productUpdate: Database['public']['Tables']['products']['Update'] = productFields
  const { data: updated, error } = await supabase.from('products')
    .update(productUpdate)
    .eq('id', idRaw)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message, nonce: 0 }
  if (!updated) return { error: 'That product could not be found.', nonce: 0 }

  // Only touch cost history if a cost actually changed.
  const { data: costs } = await supabase
    .from('product_costs')
    .select('*')
    .eq('product_id', idRaw)
    .is('effective_to', null)
  const current = (costs ?? []).sort((a: any, b: any) => b.effective_from.localeCompare(a.effective_from))[0]
  const changed =
    !current ||
    current.ingredient_cost !== p.ingredientCost ||
    current.packaging_cost !== p.packagingCost ||
    current.other_cost !== p.otherCost
  if (changed) {
    // Insert the new cost first, then close the old one, so a failure never leaves no cost at all.
    const costInsert: Database['public']['Tables']['product_costs']['Insert'] = { product_id: idRaw, ...costFields }
    const { error: costError } = await supabase.from('product_costs').insert(costInsert)
    if (costError) return { error: costError.message, nonce: 0 }
    if (current) {
      await supabase.from('product_costs').update({ effective_to: new Date().toISOString() }).eq('id', current.id)
    }
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId, user_id: userId, action: 'product_edited', entity_type: 'product', entity_id: idRaw,
  })
  revalidatePath('/business', 'layout')
  return { error: null, nonce: Date.now() }
}

/** Past orders keep the product's name and price (snapshotted on the order), so deleting is safe. */
export async function deleteProduct(formData: FormData): Promise<void> {
  const id = String(formData.get('productId') ?? '')
  if (!UUID.test(id)) return
  const ctx = await getActionContext()
  if (!ctx.ok) throw new Error(ctx.error)
  const { error } = await ctx.supabase.from('products').delete().eq('id', id).eq('business_id', ctx.businessId)
  if (error) throw new Error(error.message)
  revalidatePath('/business', 'layout')
  redirect('/business/products')
}

export type ReadyStockChange = 'add' | 'remove' | 'set' | 'untrack'

export interface ReadyStockResult {
  error: string | null
  readyStock: number | null
}

const MAX_STOCK = 100_000

/**
 * Changes a product's ready stock: add a fresh batch, remove some (eaten,
 * given away, spoiled), set the exact count after counting, or stop tracking.
 * Sold items come off automatically when an order is completed (migration 0017).
 */
export async function changeReadyStock(productId: string, change: ReadyStockChange, quantity: number): Promise<ReadyStockResult> {
  if (!UUID.test(productId)) return { error: 'Invalid product.', readyStock: null }
  if (!['add', 'remove', 'set', 'untrack'].includes(change)) return { error: 'Invalid change.', readyStock: null }
  if (change !== 'untrack' && (!Number.isInteger(quantity) || quantity < 0 || quantity > MAX_STOCK)) {
    return { error: 'Enter a whole number.', readyStock: null }
  }
  if ((change === 'add' || change === 'remove') && quantity === 0) return { error: 'Enter how many.', readyStock: null }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, readyStock: null }
  const { supabase, businessId, userId } = ctx

  // Make sure it's this business's product before touching it.
  const { data: product, error: findError } = await supabase
    .from('products')
    .select('id, name, ready_stock')
    .eq('id', productId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (findError) return { error: findError.message, readyStock: null }
  if (!product) return { error: 'That product could not be found.', readyStock: null }

  let readyStock: number | null
  if (change === 'add' || change === 'remove') {
    const { data, error } = await supabase.rpc('adjust_product_ready_stock', {
      p_product_id: productId,
      p_change: change === 'add' ? quantity : -quantity,
    })
    if (error) return { error: error.message, readyStock: null }
    readyStock = (data as number | null) ?? null
  } else {
    readyStock = change === 'set' ? quantity : null
    const { error } = await supabase
      .from('products')
      .update({ ready_stock: readyStock })
      .eq('id', productId)
      .eq('business_id', businessId)
    if (error) return { error: error.message, readyStock: null }
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'ready_stock_changed',
    entity_type: 'product',
    entity_id: productId,
    metadata: { change, quantity, before: product.ready_stock, after: readyStock },
  })

  revalidatePath('/business/products', 'layout')
  revalidatePath('/orders', 'layout')
  return { error: null, readyStock }
}
