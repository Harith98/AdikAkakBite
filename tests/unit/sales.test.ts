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
        { saleDate: '2026-09-05', total: 34, items: [{ name: 'Brownies Klasik', quantity: 2, amount: 34, unitCost: 8 }] },
        { saleDate: '2026-09-05', total: 17, items: [{ name: 'brownies klasik ', quantity: 1, amount: 17, unitCost: 8 }] },
        { saleDate: '2026-09-20', total: 60, items: [{ name: 'Kek Batik', quantity: 1, amount: 60, unitCost: 25.5 }] },
      ],
      '2026-09'
    )
    expect(r.totals).toEqual({ revenue: 111, orders: 3, averageOrderValue: 37 })
    expect(r.days).toHaveLength(30)
    expect(r.days.find((d) => d.date === '2026-09-05')).toEqual({ date: '2026-09-05', revenue: 51, orders: 2 })
    expect(r.topProducts[0]).toEqual({ name: 'Kek Batik', quantity: 1, revenue: 60, profit: 34.5 })
    expect(r.topProducts[1]).toEqual({ name: 'Brownies Klasik', quantity: 3, revenue: 51, profit: 27 })
    expect(r.bestDay).toEqual({ date: '2026-09-20', revenue: 60 })
    expect(r.profit).toEqual({ cost: 49.5, profit: 61.5, margin: 55.4, missingCost: [] })
  })

  it('flags items with no cost and leaves them out of costs', async () => {
    const { buildMonthReport } = await import('@/lib/calc/sales')
    const r = buildMonthReport(
      [
        {
          saleDate: '2026-10-04',
          total: 90,
          items: [
            { name: 'Brownies Klasik 8″', quantity: 2, amount: 80, unitCost: 15 },
            { name: 'Brownies Couple Set', quantity: 1, amount: 10, unitCost: null },
          ],
        },
      ],
      '2026-10'
    )
    expect(r.profit).toEqual({ cost: 30, profit: 60, margin: 66.7, missingCost: ['Brownies Couple Set'] })
    expect(r.topProducts.find((p) => p.name === 'Brownies Couple Set')?.profit).toBeNull()
  })

  it('uses the cost a product had on the day of the sale', async () => {
    const { costOnDate } = await import('@/lib/calc/sales')
    const history = [
      { effectiveFrom: '2026-09-01T03:00:00Z', unitCost: 10 },
      { effectiveFrom: '2026-10-15T08:00:00Z', unitCost: 12 },
    ]
    expect(costOnDate(history, '2026-09-20')).toBe(10)
    expect(costOnDate(history, '2026-10-15')).toBe(12)
    expect(costOnDate(history, '2026-11-01')).toBe(12)
    // Sold before any cost was entered: the first cost entered afterwards.
    expect(costOnDate(history, '2026-08-10')).toBe(10)
    // RM0 counts as "not entered".
    expect(costOnDate([{ effectiveFrom: '2026-09-01T00:00:00Z', unitCost: 0 }, { effectiveFrom: '2026-10-20T00:00:00Z', unitCost: 14 }], '2026-09-04')).toBe(14)
    expect(costOnDate([{ effectiveFrom: '2026-09-01T00:00:00Z', unitCost: 0 }], '2026-09-04')).toBeNull()
    expect(costOnDate([], '2026-09-04')).toBeNull()
  })

  it('compares with the month before', async () => {
    const { percentChange } = await import('@/lib/calc/sales')
    expect(percentChange(120, 100)).toBe(20)
    expect(percentChange(80, 100)).toBe(-20)
    expect(percentChange(50, 0)).toBeNull()
  })
})

describe('financial report', () => {
  const order = (saleDate: string, subtotal: number, items: { quantity: number; unitCost: number | null }[], discount = 0, deliveryFee = 0) => ({
    saleDate,
    subtotal,
    discount,
    deliveryFee,
    total: subtotal - discount + deliveryFee,
    items,
  })

  it('sums each month and adds a TOTAL row that equals the months together', async () => {
    const { financeByMonth } = await import('@/lib/calc/sales')
    const rows = financeByMonth([
      order('2026-10-02', 80, [{ quantity: 2, unitCost: 15 }], 5, 7),
      order('2026-09-04', 40, [{ quantity: 1, unitCost: 15 }]),
      order('2026-09-26', 105, [{ quantity: 1, unitCost: 22.5 }, { quantity: 1, unitCost: null }]),
    ])
    expect(rows.map((r) => r.month)).toEqual(['2026-09', '2026-10', 'TOTAL'])
    expect(rows[0]).toEqual({
      month: '2026-09',
      orders: 2,
      itemSales: 145,
      discounts: 0,
      deliveryFees: 0,
      sales: 145,
      cost: 37.5,
      grossProfit: 107.5,
      margin: 74.1,
      averageOrder: 72.5,
      unitsWithoutCost: 1,
      overheads: 0,
      netProfit: 107.5,
    })
    expect(rows[1]).toMatchObject({ orders: 1, itemSales: 80, discounts: 5, deliveryFees: 7, sales: 82, cost: 30, grossProfit: 52 })
    const total = rows[2]!
    for (const key of ['orders', 'itemSales', 'discounts', 'deliveryFees', 'sales', 'cost', 'grossProfit', 'unitsWithoutCost'] as const) {
      expect(total[key]).toBeCloseTo(rows[0]![key] + rows[1]![key], 2)
    }
  })

  it('takes overheads off gross profit, including months with no sales', async () => {
    const { financeByMonth } = await import('@/lib/calc/sales')
    const rows = financeByMonth(
      [order('2026-10-02', 100, [{ quantity: 2, unitCost: 15 }])],
      [
        { date: '2026-09-10', amount: 400 },
        { date: '2026-10-10', amount: 400 },
        { date: '2026-10-15', amount: 35.5 },
      ]
    )
    expect(rows.map((r) => [r.month, r.grossProfit, r.overheads, r.netProfit])).toEqual([
      ['2026-09', 0, 400, -400],
      ['2026-10', 70, 435.5, -365.5],
      ['TOTAL', 70, 835.5, -765.5],
    ])
  })

  it('still has a TOTAL row when there are no sales', async () => {
    const { financeByMonth } = await import('@/lib/calc/sales')
    expect(financeByMonth([])).toEqual([
      { month: 'TOTAL', orders: 0, itemSales: 0, discounts: 0, deliveryFees: 0, sales: 0, cost: 0, grossProfit: 0, margin: null, averageOrder: 0, unitsWithoutCost: 0, overheads: 0, netProfit: 0 },
    ])
  })
})
