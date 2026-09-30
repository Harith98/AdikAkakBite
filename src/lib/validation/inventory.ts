import { fail, parseMoney, str, type FormSource, type ParseResult } from './common'

export interface ParsedInventoryItem {
  name: string
  category: string | null
  unit: string
  currentQuantity: number
  reorderLevel: number
  unitCost: number
  supplier: string | null
  expiryDate: string | null
  notes: string | null
}

const MAX_QTY = 1_000_000

function parseQuantity(raw: string, label: string): ParseResult<number> {
  const cleaned = raw.replace(/[,\s]/g, '')
  if (cleaned === '') return { ok: true, value: 0 }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return fail(`${label} must be a number.`)
  if (n < 0) return fail(`${label} can't be negative.`)
  if (n > MAX_QTY) return fail(`${label} is too large.`)
  return { ok: true, value: Math.round((n + Number.EPSILON) * 1000) / 1000 }
}

/** Create/edit an inventory item. `currentQuantity` is only used on create — see saveInventoryItem. */
export function parseInventoryItemForm(form: FormSource): ParseResult<ParsedInventoryItem> {
  const name = str(form, 'name')
  if (!name) return fail('Give the item a name.')
  if (name.length > 100) return fail('The name is too long.')

  const unit = str(form, 'unit')
  if (!unit) return fail('Enter a unit (e.g. kg, pcs, L).')
  if (unit.length > 20) return fail('The unit is too long.')

  const category = str(form, 'category')
  if (category.length > 50) return fail('The category is too long.')
  const supplier = str(form, 'supplier')
  if (supplier.length > 100) return fail('The supplier name is too long.')
  const notes = str(form, 'notes')
  if (notes.length > 500) return fail('Keep notes under 500 characters.')
  const expiryDate = str(form, 'expiryDate')

  const currentQuantity = parseQuantity(str(form, 'currentQuantity'), 'Starting quantity')
  if (!currentQuantity.ok) return currentQuantity
  const reorderLevel = parseQuantity(str(form, 'reorderLevel'), 'Reorder level')
  if (!reorderLevel.ok) return reorderLevel
  const unitCost = parseMoney(str(form, 'unitCost'), 'Unit cost', 100_000)
  if (!unitCost.ok) return unitCost

  return {
    ok: true,
    value: {
      name,
      category: category || null,
      unit,
      currentQuantity: currentQuantity.value,
      reorderLevel: reorderLevel.value,
      unitCost: unitCost.value,
      supplier: supplier || null,
      expiryDate: expiryDate || null,
      notes: notes || null,
    },
  }
}

export interface ParsedTransaction {
  quantity: number
  transactionType: 'purchase' | 'usage' | 'waste' | 'adjustment'
  transactionDate: string
  reference: string | null
  notes: string | null
}

const TRANSACTION_TYPES = ['purchase', 'usage', 'waste', 'adjustment'] as const

export function parseTransactionForm(form: FormSource, today: string): ParseResult<ParsedTransaction> {
  const type = str(form, 'transactionType')
  if (!TRANSACTION_TYPES.includes(type as (typeof TRANSACTION_TYPES)[number])) return fail('Choose a transaction type.')

  const quantity = parseQuantity(str(form, 'quantity'), 'Quantity')
  if (!quantity.ok) return quantity
  if (quantity.value === 0) return fail('Enter a quantity greater than zero.')

  const reference = str(form, 'reference')
  if (reference.length > 100) return fail('The reference is too long.')
  const notes = str(form, 'notes')
  if (notes.length > 500) return fail('Keep notes under 500 characters.')
  const transactionDate = str(form, 'transactionDate') || today

  return {
    ok: true,
    value: {
      quantity: quantity.value,
      transactionType: type as ParsedTransaction['transactionType'],
      transactionDate,
      reference: reference || null,
      notes: notes || null,
    },
  }
}
