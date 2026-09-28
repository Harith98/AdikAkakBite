import { describe, it, expect } from 'vitest'
import { calculateProductEconomics } from '@/lib/calc/products'
import { parseProductForm } from '@/lib/validation/products'

describe('calculateProductEconomics', () => {
  it('matches the spec formulas', () => {
    const r = calculateProductEconomics({ sellingPrice: 25, ingredientCost: 8.5, packagingCost: 2, otherCost: 1 })
    expect(r.totalCost).toBe(11.5)
    expect(r.grossProfit).toBe(13.5)
    expect(r.grossMargin).toBe(54)
  })
  it('reports a loss as negative profit and margin', () => {
    const r = calculateProductEconomics({ sellingPrice: 10, ingredientCost: 12, packagingCost: 0, otherCost: 0 })
    expect(r.grossProfit).toBe(-2)
    expect(r.grossMargin).toBe(-20)
  })
  it('has no margin when the selling price is zero (instead of dividing by zero)', () => {
    const r = calculateProductEconomics({ sellingPrice: 0, ingredientCost: 5, packagingCost: 0, otherCost: 0 })
    expect(r.grossMargin).toBeNull()
    expect(r.grossProfit).toBe(-5)
  })
  it('treats missing, negative and NaN inputs as zero', () => {
    const r = calculateProductEconomics({ sellingPrice: 20, ingredientCost: null, packagingCost: -3, otherCost: NaN })
    expect(r.totalCost).toBe(0)
    expect(r.grossMargin).toBe(100)
  })
  it('avoids floating-point noise', () => {
    expect(calculateProductEconomics({ sellingPrice: 1, ingredientCost: 0.1, packagingCost: 0.2, otherCost: 0 }).totalCost).toBe(0.3)
  })
})

const form = (o: Record<string, string>) => new Map(Object.entries(o))
const valid = { name: 'Brownie Box', sellingPrice: '25', ingredientCost: '8.50', packagingCost: '2', otherCost: '1', isActive: 'on' }

describe('parseProductForm', () => {
  it('accepts a valid product and keeps optional fields null', () => {
    const r = parseProductForm(form(valid))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.sellingPrice).toBe(25)
      expect(r.value.category).toBeNull()
      expect(r.value.isActive).toBe(true)
    }
  })
  it('requires a name', () => {
    expect(parseProductForm(form({ ...valid, name: '  ' })).ok).toBe(false)
  })
  it('rejects negative and non-numeric prices', () => {
    expect(parseProductForm(form({ ...valid, sellingPrice: '-1' })).ok).toBe(false)
    expect(parseProductForm(form({ ...valid, ingredientCost: 'abc' })).ok).toBe(false)
  })
  it('treats blank costs as zero (missing optional fields)', () => {
    const r = parseProductForm(form({ name: 'X', sellingPrice: '5' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.otherCost).toBe(0)
  })
  it('accepts thousands separators', () => {
    const r = parseProductForm(form({ ...valid, sellingPrice: '1,250.50' }))
    expect(r.ok && r.value.sellingPrice === 1250.5).toBe(true)
  })
  it('only accepts http(s) image links', () => {
    expect(parseProductForm(form({ ...valid, imageUrl: 'javascript:alert(1)' })).ok).toBe(false)
    expect(parseProductForm(form({ ...valid, imageUrl: 'https://example.com/a.jpg' })).ok).toBe(true)
  })
  it('is inactive when the checkbox is absent', () => {
    const { isActive: _ignored, ...rest } = valid
    const r = parseProductForm(form(rest))
    expect(r.ok && r.value.isActive === false).toBe(true)
  })
})
