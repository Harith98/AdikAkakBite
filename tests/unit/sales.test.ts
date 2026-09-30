import { describe, it, expect } from 'vitest'
import { summarizeSales } from '@/lib/calc/sales'

describe('summarizeSales', () => {
  it('totals revenue and computes average order value', () => {
    const r = summarizeSales([{ saleDate: '2026-09-28', total: 25 }, { saleDate: '2026-09-28', total: 45.5 }])
    expect(r.revenue).toBe(70.5)
    expect(r.orders).toBe(2)
    expect(r.averageOrderValue).toBe(35.25)
  })
  it('handles zero orders without dividing by zero', () => {
    const r = summarizeSales([])
    expect(r.revenue).toBe(0)
    expect(r.orders).toBe(0)
    expect(r.averageOrderValue).toBe(0)
  })
  it('ignores a non-finite total instead of corrupting the sum', () => {
    const r = summarizeSales([{ saleDate: '2026-09-28', total: NaN }, { saleDate: '2026-09-28', total: 10 }])
    expect(r.revenue).toBe(10)
  })
  it('avoids floating-point noise', () => {
    expect(summarizeSales([{ saleDate: '2026-09-28', total: 0.1 }, { saleDate: '2026-09-28', total: 0.2 }]).revenue).toBe(0.3)
  })
})
