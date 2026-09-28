import { describe, it, expect } from 'vitest'
import { calculateOrderTotals } from '@/lib/calc/orders'
import { getInventoryStatus, needsReorder } from '@/lib/calc/inventory'

describe('calculateOrderTotals', () => {
  it('computes subtotal, total and balance', () => {
    const t = calculateOrderTotals({
      items: [{ quantity: 2, unitPrice: 25 }, { quantity: 1, unitPrice: 18 }],
      discount: 5,
      deliveryFee: 8,
      deposit: 30,
    })
    expect(t.subtotal).toBe(68)
    expect(t.total).toBe(71)
    expect(t.balance).toBe(41)
  })
  it('handles an order with no items', () => {
    const t = calculateOrderTotals({ items: [] })
    expect(t.total).toBe(0)
    expect(t.balance).toBe(0)
  })
  it('never lets a discount push the total below the delivery fee', () => {
    const t = calculateOrderTotals({ items: [{ quantity: 1, unitPrice: 10 }], discount: 50, deliveryFee: 3 })
    expect(t.discount).toBe(10)
    expect(t.total).toBe(3)
  })
  it('never lets a deposit exceed the total', () => {
    const t = calculateOrderTotals({ items: [{ quantity: 1, unitPrice: 10 }], deposit: 99 })
    expect(t.deposit).toBe(10)
    expect(t.balance).toBe(0)
  })
  it('treats negative, NaN and missing values as zero', () => {
    const t = calculateOrderTotals({
      items: [{ quantity: -2, unitPrice: 25 }, { quantity: NaN, unitPrice: 10 }, { quantity: 1, unitPrice: 12 }],
      discount: null,
      deliveryFee: -4,
      deposit: undefined,
    })
    expect(t.total).toBe(12)
  })
  it('rounds to two decimals', () => {
    expect(calculateOrderTotals({ items: [{ quantity: 3, unitPrice: 0.1 }] }).total).toBe(0.3)
  })
})

describe('getInventoryStatus', () => {
  it('is ok well above the reorder level', () => {
    expect(getInventoryStatus(10, 2)).toBe('ok')
  })
  it('is low when within 50% above the reorder level', () => {
    expect(getInventoryStatus(3, 2)).toBe('low')
  })
  it('is reorder at exactly the reorder level (spec: quantity <= level)', () => {
    expect(getInventoryStatus(2, 2)).toBe('reorder')
    expect(getInventoryStatus(1, 2)).toBe('reorder')
  })
  it('is out of stock at zero or below', () => {
    expect(getInventoryStatus(0, 2)).toBe('out_of_stock')
    expect(getInventoryStatus(-5, 2)).toBe('out_of_stock')
  })
  it('treats invalid numbers safely', () => {
    expect(getInventoryStatus(NaN, 2)).toBe('out_of_stock')
    expect(getInventoryStatus(5, NaN)).toBe('ok')
  })
  it('only reorder and out_of_stock need action', () => {
    expect(needsReorder('reorder')).toBe(true)
    expect(needsReorder('out_of_stock')).toBe(true)
    expect(needsReorder('low')).toBe(false)
    expect(needsReorder('ok')).toBe(false)
  })
})
