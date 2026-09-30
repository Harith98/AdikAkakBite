import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InventoryTransactionType } from '@/lib/supabase/database.types'
import { getInventoryStatus, type InventoryStatusValue } from '@/lib/calc/inventory'

type Client = SupabaseClient<Database>
type ItemRow = Database['public']['Tables']['inventory_items']['Row']
type TransactionRow = Database['public']['Tables']['inventory_transactions']['Row']

export interface InventoryItemView extends ItemRow {
  status: InventoryStatusValue
}

export async function getInventoryItems(supabase: Client, businessId: string): Promise<InventoryItemView[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
  if (error) throw new Error(`Could not load inventory: ${error.message}`)
  return (data ?? []).map((item) => ({ ...item, status: getInventoryStatus(item.current_quantity, item.reorder_level) }))
}

export async function getInventoryItem(supabase: Client, businessId: string, itemId: string): Promise<InventoryItemView | null> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('id', itemId)
    .maybeSingle()
  if (error) throw new Error(`Could not load the item: ${error.message}`)
  if (!data) return null
  return { ...data, status: getInventoryStatus(data.current_quantity, data.reorder_level) }
}

export async function getRecentTransactions(
  supabase: Client,
  itemId: string,
  limit = 20
): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .eq('inventory_item_id', itemId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Could not load recent transactions: ${error.message}`)
  return data ?? []
}

/**
 * Logs a transaction and updates the item's stock in one atomic step
 * (migration 0007's record_inventory_transaction), so two transactions
 * logged at the same moment can't race and silently drop one of them.
 */
export async function recordInventoryTransaction(
  supabase: Client,
  input: {
    businessId: string
    inventoryItemId: string
    quantity: number
    unit: string
    transactionType: InventoryTransactionType
    transactionDate: string
    reference: string | null
    notes: string | null
  }
): Promise<ItemRow> {
  const { data, error } = await supabase.rpc('record_inventory_transaction', {
    p_business_id: input.businessId,
    p_inventory_item_id: input.inventoryItemId,
    p_quantity: input.quantity,
    p_unit: input.unit,
    p_transaction_type: input.transactionType,
    p_transaction_date: input.transactionDate,
    p_reference: input.reference,
    p_notes: input.notes,
  })
  if (error) throw new Error(`Could not record the transaction: ${error.message}`)
  return data
}
