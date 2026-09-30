'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/services/action-context'
import { recordInventoryTransaction } from '@/lib/services/inventory'
import { getBusinessNow } from '@/lib/time'
import { parseInventoryItemForm, parseTransactionForm } from '@/lib/validation/inventory'
import { UUID_PATTERN } from '@/lib/validation/common'
import { getInventoryStatus } from '@/lib/calc/inventory'
import { lowStockMessage, shouldAlertLowStock } from '@/lib/notifications/messages'
import { notifyTeam } from '@/lib/notifications/push'

export interface SaveItemState {
  error: string | null
  nonce: number
}
export interface LogTransactionState {
  error: string | null
  nonce: number
}

/** Create a new inventory item, or edit an existing one's details (name/category/unit/reorder level/cost/etc). Stock quantity is only set here on create — afterwards it changes only through logged transactions. */
export async function saveInventoryItem(_prev: SaveItemState, formData: FormData): Promise<SaveItemState> {
  const parsed = parseInventoryItemForm(formData)
  if (!parsed.ok) return { error: parsed.error, nonce: 0 }
  const item = parsed.value

  const idRaw = String(formData.get('itemId') ?? '')
  if (idRaw && !UUID_PATTERN.test(idRaw)) return { error: 'Invalid item.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const { supabase, businessId, userId } = ctx

  if (!idRaw) {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        business_id: businessId,
        name: item.name,
        category: item.category,
        unit: item.unit,
        current_quantity: item.currentQuantity,
        reorder_level: item.reorderLevel,
        unit_cost: item.unitCost,
        supplier: item.supplier,
        expiry_date: item.expiryDate,
        notes: item.notes,
      })
      .select('id')
      .single()
    if (error) return { error: error.message, nonce: 0 }
    await supabase.from('business_activity_logs').insert({
      business_id: businessId, user_id: userId, action: 'inventory_item_created', entity_type: 'inventory_item', entity_id: data.id,
    })
    revalidatePath('/business', 'layout')
    revalidatePath('/today')
    redirect('/business/inventory')
  }

  // Kept to notify the team if raising the reorder level makes the item low.
  const { data: before } = await supabase
    .from('inventory_items')
    .select('current_quantity, reorder_level')
    .eq('id', idRaw)
    .eq('business_id', businessId)
    .maybeSingle()

  // Editing never touches current_quantity — only a transaction does.
  const { data: updated, error } = await supabase
    .from('inventory_items')
    .update({
      name: item.name,
      category: item.category,
      unit: item.unit,
      reorder_level: item.reorderLevel,
      unit_cost: item.unitCost,
      supplier: item.supplier,
      expiry_date: item.expiryDate,
      notes: item.notes,
    })
    .eq('id', idRaw)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message, nonce: 0 }
  if (!updated) return { error: 'That item could not be found.', nonce: 0 }

  if (before) {
    await alertIfNowLow(businessId, idRaw, before, {
      name: item.name,
      unit: item.unit,
      current_quantity: before.current_quantity,
      reorder_level: item.reorderLevel,
    })
  }

  revalidatePath('/business', 'layout')
  revalidatePath('/today')
  return { error: null, nonce: Date.now() }
}

/** Pushes a "Low stock" / "Out of stock" notification when a change newly puts an item there. */
async function alertIfNowLow(
  businessId: string,
  itemId: string,
  before: { current_quantity: number; reorder_level: number },
  after: { name: string; unit: string; current_quantity: number; reorder_level: number }
) {
  const was = getInventoryStatus(before.current_quantity, before.reorder_level)
  const now = getInventoryStatus(after.current_quantity, after.reorder_level)
  if (!shouldAlertLowStock(was, now)) return
  await notifyTeam(
    businessId,
    'low_stock',
    lowStockMessage({
      id: itemId,
      name: after.name,
      unit: after.unit,
      currentQuantity: after.current_quantity,
      reorderLevel: after.reorder_level,
      status: now,
    })
  )
}

export async function deleteInventoryItem(formData: FormData): Promise<void> {
  const id = String(formData.get('itemId') ?? '')
  if (!UUID_PATTERN.test(id)) return
  const ctx = await getActionContext()
  if (!ctx.ok) throw new Error(ctx.error)
  // inventory_transactions references this item with ON DELETE CASCADE (migration 0001),
  // so its usage history is removed too — deleting an item is meant to be permanent.
  const { error } = await ctx.supabase.from('inventory_items').delete().eq('id', id).eq('business_id', ctx.businessId)
  if (error) throw new Error(error.message)
  revalidatePath('/business', 'layout')
  revalidatePath('/today')
  redirect('/business/inventory')
}

/** Logs a purchase, usage, waste or adjustment against one item (spec §18). */
export async function logTransaction(itemId: string, _prev: LogTransactionState, formData: FormData): Promise<LogTransactionState> {
  if (!UUID_PATTERN.test(itemId)) return { error: 'Invalid item.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const { supabase, businessId, userId, timezone } = ctx

  const parsed = parseTransactionForm(formData, getBusinessNow(timezone).isoDate)
  if (!parsed.ok) return { error: parsed.error, nonce: 0 }
  const t = parsed.value

  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .select('name, unit, current_quantity, reorder_level')
    .eq('id', itemId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (itemError) return { error: itemError.message, nonce: 0 }
  if (!item) return { error: 'That item could not be found.', nonce: 0 }

  let after
  try {
    after = await recordInventoryTransaction(supabase, {
      businessId,
      inventoryItemId: itemId,
      quantity: t.quantity,
      unit: item.unit,
      transactionType: t.transactionType,
      transactionDate: t.transactionDate,
      reference: t.reference,
      notes: t.notes,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not record the transaction.', nonce: 0 }
  }

  await supabase.from('business_activity_logs').insert({
    business_id: businessId, user_id: userId, action: 'inventory_changed', entity_type: 'inventory_item', entity_id: itemId,
    metadata: { transaction_type: t.transactionType, quantity: t.quantity },
  })

  await alertIfNowLow(businessId, itemId, item, { ...item, current_quantity: after.current_quantity })

  revalidatePath('/business', 'layout')
  revalidatePath('/today')
  return { error: null, nonce: Date.now() }
}
