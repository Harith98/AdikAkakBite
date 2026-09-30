import { describe, it, expect } from 'vitest'
import { parseInventoryItemForm, parseTransactionForm } from '@/lib/validation/inventory'

const form = (o: Record<string, string> = {}) => new Map(Object.entries(o))
const validItem = { name: 'Chocolate (dark, 70%)', unit: 'kg', currentQuantity: '3', reorderLevel: '2', unitCost: '32' }

describe('parseInventoryItemForm', () => {
  it('accepts a valid item', () => {
    const r = parseInventoryItemForm(form(validItem))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.currentQuantity).toBe(3)
      expect(r.value.category).toBeNull()
    }
  })
  it('requires a name and a unit', () => {
    expect(parseInventoryItemForm(form({ ...validItem, name: ' ' })).ok).toBe(false)
    expect(parseInventoryItemForm(form({ ...validItem, unit: '' })).ok).toBe(false)
  })
  it('rejects a negative or non-numeric quantity', () => {
    expect(parseInventoryItemForm(form({ ...validItem, currentQuantity: '-1' })).ok).toBe(false)
    expect(parseInventoryItemForm(form({ ...validItem, reorderLevel: 'abc' })).ok).toBe(false)
  })
  it('treats a blank starting quantity as zero (missing optional field)', () => {
    const r = parseInventoryItemForm(form({ name: 'Boxes', unit: 'pcs' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.currentQuantity).toBe(0)
  })
  it('keeps three decimal places for fractional units like kg', () => {
    const r = parseInventoryItemForm(form({ ...validItem, currentQuantity: '2.755' }))
    expect(r.ok && r.value.currentQuantity === 2.755).toBe(true)
  })
})

describe('parseTransactionForm', () => {
  it('accepts a valid purchase', () => {
    const r = parseTransactionForm(form({ transactionType: 'purchase', quantity: '5' }), '2026-09-28')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.transactionDate).toBe('2026-09-28') // defaults to today
  })
  it('rejects an unknown transaction type', () => {
    expect(parseTransactionForm(form({ transactionType: 'refund', quantity: '5' }), '2026-09-28').ok).toBe(false)
  })
  it('rejects a zero or negative quantity', () => {
    expect(parseTransactionForm(form({ transactionType: 'usage', quantity: '0' }), '2026-09-28').ok).toBe(false)
    expect(parseTransactionForm(form({ transactionType: 'usage', quantity: '-2' }), '2026-09-28').ok).toBe(false)
  })
  it('allows an explicit past date (backdating a purchase)', () => {
    const r = parseTransactionForm(form({ transactionType: 'purchase', quantity: '5', transactionDate: '2026-09-01' }), '2026-09-28')
    expect(r.ok && r.value.transactionDate === '2026-09-01').toBe(true)
  })
})
