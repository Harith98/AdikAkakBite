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

describe('monthly report', () => {
  it('handles month ranges and steps across years', async () => {
    const { monthRange, shiftMonth, isMonthKey } = await import('@/lib/calc/sales')
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28', days: 28 })
    expect(monthRange('2028-02').days).toBe(29)
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(isMonthKey('2026-09')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
  })

  it('totals by day and ranks products by revenue', async () => {
    const { buildMonthReport } = await import('@/lib/calc/sales')
    const r = buildMonthReport(
      [
        { saleDate: '2026-09-05', total: 34, items: [{ name: 'Brownies Klasik', quantity: 2, amount: 34 }] },
        { saleDate: '2026-09-05', total: 17, items: [{ name: 'brownies klasik ', quantity: 1, amount: 17 }] },
        { saleDate: '2026-09-20', total: 60, items: [{ name: 'Kek Batik', quantity: 1, amount: 60 }] },
      ],
      '2026-09'
    )
    expect(r.totals).toEqual({ revenue: 111, orders: 3, averageOrderValue: 37 })
    expect(r.days).toHaveLength(30)
    expect(r.days.find((d) => d.date === '2026-09-05')).toEqual({ date: '2026-09-05', revenue: 51, orders: 2 })
    expect(r.topProducts[0]).toEqual({ name: 'Kek Batik', quantity: 1, revenue: 60 })
    expect(r.topProducts[1]).toEqual({ name: 'Brownies Klasik', quantity: 3, revenue: 51 })
    expect(r.bestDay).toEqual({ date: '2026-09-20', revenue: 60 })
  })

  it('compares with the month before', async () => {
    const { percentChange } = await import('@/lib/calc/sales')
    expect(percentChange(120, 100)).toBe(20)
    expect(percentChange(80, 100)).toBe(-20)
    expect(percentChange(50, 0)).toBeNull()
  })
})
