import { describe, it, expect } from 'vitest'
import { parseOrderForm } from '@/lib/validation/orders'
import { derivePaymentStatus } from '@/lib/calc/orders'

const PRODUCT_ID = '3f2b8c1e-5a4d-4e7f-9b1a-2c3d4e5f6a7b'
const item = (o: Record<string, unknown> = {}) => ({ productId: PRODUCT_ID, productName: 'Brownie Box', quantity: 2, unitPrice: 25, ...o })
const form = (o: Record<string, string> = {}, items: unknown[] = [item()]) =>
  new Map<string, string>(Object.entries({ customerName: 'Sarah', items: JSON.stringify(items), ...o }))

describe('parseOrderForm', () => {
  it('accepts a valid order and calculates totals server-side', () => {
    const r = parseOrderForm(form({ requiredDate: '2026-09-28', requiredTime: '16:00', discount: '5', deliveryFee: '8', deposit: '20', customerPhone: ' 012-345 6789 ' }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.totals.subtotal).toBe(50)
      expect(r.value.totals.total).toBe(53)
      expect(r.value.totals.balance).toBe(33)
      expect(r.value.paymentStatus).toBe('deposit_paid')
      expect(r.value.customerPhone).toBe('012-345 6789')
    }
  })

  it('rejects a phone number that is too short to identify anyone', () => {
    expect(parseOrderForm(form({ customerPhone: '012' })).ok).toBe(false)
  })
  it('requires a customer name', () => {
    expect(parseOrderForm(form({ customerName: ' ' })).ok).toBe(false)
  })
  it('requires at least one item', () => {
    expect(parseOrderForm(form({}, [])).ok).toBe(false)
    expect(parseOrderForm(form({ items: 'not json' })).ok).toBe(false)
  })
  it('rejects invalid quantities (zero, negative, fractional, huge)', () => {
    for (const quantity of [0, -1, 1.5, 5000, 'abc']) {
      expect(parseOrderForm(form({}, [item({ quantity })])).ok).toBe(false)
    }
  })
  it('rejects a negative or non-numeric item price', () => {
    expect(parseOrderForm(form({}, [item({ unitPrice: -5 })])).ok).toBe(false)
    expect(parseOrderForm(form({}, [item({ unitPrice: 'free' })])).ok).toBe(false)
  })
  it('allows a custom item with no product', () => {
    expect(parseOrderForm(form({}, [item({ productId: null, productName: 'Custom cake' })])).ok).toBe(true)
  })
  it('rejects a malformed product id', () => {
    expect(parseOrderForm(form({}, [item({ productId: "1'; drop table" })])).ok).toBe(false)
  })
  it('rejects a discount larger than the items total', () => {
    expect(parseOrderForm(form({ discount: '60' })).ok).toBe(false)
  })
  it('rejects a deposit larger than the total', () => {
    expect(parseOrderForm(form({ deposit: '999' })).ok).toBe(false)
  })
  it('"paid in full" sets the deposit to the total and marks it fully paid', () => {
    const r = parseOrderForm(form({ paidInFull: 'on', deliveryFee: '5' }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.deposit).toBe(55)
      expect(r.value.paymentStatus).toBe('fully_paid')
      expect(r.value.totals.balance).toBe(0)
    }
  })
  it('rejects an impossible date and a time without a date', () => {
    expect(parseOrderForm(form({ requiredDate: '2026-02-30' })).ok).toBe(false)
    expect(parseOrderForm(form({ requiredTime: '16:00' })).ok).toBe(false)
    expect(parseOrderForm(form({ requiredDate: '2026-09-28', requiredTime: '25:00' })).ok).toBe(false)
  })
  it('allows an order with no date or time', () => {
    const r = parseOrderForm(form())
    expect(r.ok && r.value.requiredDate === null).toBe(true)
  })
})

describe('derivePaymentStatus', () => {
  it('follows the money', () => {
    expect(derivePaymentStatus(50, 0)).toBe('unpaid')
    expect(derivePaymentStatus(50, 20)).toBe('deposit_paid')
    expect(derivePaymentStatus(50, 50)).toBe('fully_paid')
  })
  it('never calls a zero-total order fully paid', () => {
    expect(derivePaymentStatus(0, 0)).toBe('unpaid')
  })
})
