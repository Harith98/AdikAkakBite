'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/supabase/database.types'
import { getActionContext } from '@/lib/services/action-context'
import { parseProductForm } from '@/lib/validation/products'
import { PRODUCT_IMAGE_BUCKET, productImagePath } from '@/lib/product-images'
import { recipeCostPerUnit } from '@/lib/calc/recipes'
import { getRecipe } from '@/lib/services/recipes'
import { alertNewlyLowStock, snapshotStock } from '@/lib/notifications/low-stock'
import { getBusinessNow } from '@/lib/time'

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
    // Sent only when there's something to save (or clear), so products still save
    // before migration 0026 adds the column.
    ...(p.nicknames.length > 0 || formData.get('hadNicknames') === '1' ? { nicknames: p.nicknames } : {}),
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

  // The old photo, to delete from storage if it's replaced or removed.
  const { data: before } = await supabase
    .from('products')
    .select('image_url')
    .eq('id', idRaw)
    .eq('business_id', businessId)
    .maybeSingle()

  const productUpdate: Database['public']['Tables']['products']['Update'] = productFields
  const { data: updated, error } = await supabase.from('products')
    .update(productUpdate)
    .eq('id', idRaw)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message, nonce: 0 }
  if (!updated) return { error: 'That product could not be found.', nonce: 0 }
  if (before?.image_url && before.image_url !== p.imageUrl) await removeProductImage(supabase, before.image_url)

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
  const { data: product } = await ctx.supabase
    .from('products')
    .select('image_url')
    .eq('id', id)
    .eq('business_id', ctx.businessId)
    .maybeSingle()
  const { error } = await ctx.supabase.from('products').delete().eq('id', id).eq('business_id', ctx.businessId)
  if (error) throw new Error(error.message)
  if (product?.image_url) await removeProductImage(ctx.supabase, product.image_url)
  revalidatePath('/business', 'layout')
  redirect('/business/products')
}

export type ReadyStockChange = 'add' | 'remove' | 'set' | 'untrack'

export interface ReadyStockResult {
  error: string | null
  readyStock: number | null
  /** How many recipe ingredients were taken out of inventory (Add batch only). */
  ingredientsUsed?: number
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
  let ingredientsUsed = 0
  if (change === 'add' || change === 'remove') {
    const { data, error } = await supabase.rpc('adjust_product_ready_stock', {
      p_product_id: productId,
      p_change: change === 'add' ? quantity : -quantity,
    })
    if (error) return { error: error.message, readyStock: null }
    readyStock = (data as number | null) ?? null

    // A new batch was made: its ingredients come out of inventory (recipe, migration 0020).
    // Removing ready stock gives nothing back: those ingredients were already used.
    if (change === 'add') {
      const before = await snapshotStock(supabase, businessId)
      const { data: used, error: usageError } = await supabase.rpc('use_recipe_ingredients', {
        p_product_id: productId,
        p_units: quantity,
        p_reference: 'batch:' + productId,
        p_date: getBusinessNow(ctx.timezone).isoDate,
      })
      if (usageError) {
        return { error: 'Stock added, but the ingredients couldn’t be deducted: ' + usageError.message, readyStock }
      }
      ingredientsUsed = Number(used ?? 0)
      if (ingredientsUsed > 0) await alertNewlyLowStock(businessId, before, await snapshotStock(supabase, businessId))
    }
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

  revalidatePath('/business', 'layout')
  revalidatePath('/orders', 'layout')
  revalidatePath('/today')
  return { error: null, readyStock, ingredientsUsed }
}

/** Deletes a photo from our bucket (best effort; links to other sites are left alone). */
async function removeProductImage(supabase: any, url: string) {
  const path = productImagePath(url, process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!path) return
  const { error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path])
  if (error) console.error('Could not delete the old product photo:', error.message)
}

// ---------------------------------------------------------------------------
// Recipes (migration 0020)
// ---------------------------------------------------------------------------

export interface RecipeLineInput {
  inventoryItemId: string
  /** Amount one batch uses, in the item's unit. */
  quantity: number
}

const MAX_RECIPE_LINES = 40
const MAX_YIELD = 10_000

/** Replaces a product's recipe: how many units a batch makes and what it uses. */
export async function saveRecipe(productId: string, recipeYield: number, lines: RecipeLineInput[]): Promise<{ error: string | null }> {
  if (!UUID.test(productId)) return { error: 'Invalid product.' }
  if (!Number.isInteger(recipeYield) || recipeYield < 1 || recipeYield > MAX_YIELD) {
    return { error: 'How many a batch makes must be a whole number of at least 1.' }
  }
  if (!Array.isArray(lines) || lines.length > MAX_RECIPE_LINES) return { error: `Use at most ${MAX_RECIPE_LINES} ingredients.` }
  for (const line of lines) {
    if (!line || !UUID.test(line.inventoryItemId)) return { error: 'Pick an ingredient for every line.' }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 1_000_000) {
      return { error: 'Every ingredient needs an amount above 0.' }
    }
  }
  const ids = lines.map((l) => l.inventoryItemId)
  if (new Set(ids).size !== ids.length) return { error: 'Each ingredient can only be listed once. Combine the amounts.' }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, businessId, userId } = ctx

  const { data: product } = await supabase.from('products').select('id').eq('id', productId).eq('business_id', businessId).maybeSingle()
  if (!product) return { error: 'That product could not be found.' }
  if (ids.length > 0) {
    const { data: items, error } = await supabase.from('inventory_items').select('id').eq('business_id', businessId).in('id', ids)
    if (error) return { error: error.message }
    if ((items ?? []).length !== ids.length) return { error: 'One of the ingredients no longer exists. Reload and try again.' }
  }

  const { error: yieldError } = await supabase
    .from('products')
    .update({ recipe_yield: recipeYield })
    .eq('id', productId)
    .eq('business_id', businessId)
  if (yieldError) return { error: yieldError.message }
  const { error: clearError } = await supabase.from('product_recipe_items').delete().eq('product_id', productId)
  if (clearError) return { error: clearError.message }
  if (lines.length > 0) {
    const { error: insertError } = await supabase.from('product_recipe_items').insert(
      lines.map((l) => ({ product_id: productId, inventory_item_id: l.inventoryItemId, quantity: Math.round(l.quantity * 1000) / 1000 }))
    )
    if (insertError) return { error: insertError.message }
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'recipe_saved',
    entity_type: 'product',
    entity_id: productId,
    metadata: { yield: recipeYield, ingredients: lines.length },
  })
  revalidatePath('/business/products', 'layout')
  return { error: null }
}

/** Sets the product's ingredient cost to what its recipe costs per unit (a new cost row; history is kept). */
export async function applyRecipeCost(productId: string): Promise<{ error: string | null; ingredientCost: number | null }> {
  if (!UUID.test(productId)) return { error: 'Invalid product.', ingredientCost: null }
  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, ingredientCost: null }
  const { supabase, businessId, userId } = ctx

  const recipe = await getRecipe(supabase, businessId, productId)
  if (recipe.lines.length === 0) return { error: 'Add ingredients to the recipe first.', ingredientCost: null }
  const ingredientCost = recipeCostPerUnit(recipe.lines, recipe.recipeYield)

  const { data: costs } = await supabase.from('product_costs').select('*').eq('product_id', productId).is('effective_to', null)
  const current = (costs ?? []).sort((a: any, b: any) => b.effective_from.localeCompare(a.effective_from))[0]
  if (current && Number(current.ingredient_cost) === ingredientCost) return { error: null, ingredientCost }

  const { error } = await supabase.from('product_costs').insert({
    product_id: productId,
    ingredient_cost: ingredientCost,
    packaging_cost: current?.packaging_cost ?? 0,
    other_cost: current?.other_cost ?? 0,
  })
  if (error) return { error: error.message, ingredientCost: null }
  if (current) await supabase.from('product_costs').update({ effective_to: new Date().toISOString() }).eq('id', current.id)

  await supabase.from('business_activity_logs').insert({
    business_id: businessId,
    user_id: userId,
    action: 'product_edited',
    entity_type: 'product',
    entity_id: productId,
    metadata: { ingredient_cost_from_recipe: ingredientCost },
  })
  revalidatePath('/business', 'layout')
  return { error: null, ingredientCost }
}
