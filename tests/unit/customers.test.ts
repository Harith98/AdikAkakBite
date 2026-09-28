import { describe, it, expect } from 'vitest'
import { computeCustomerMetrics } from '@/lib/calc/customers'
import { daysBetweenISO } from '@/lib/time'

const base = { customerId: 'c1', name: 'Sarah', today: '2026-09-28' }

describe('computeCustomerMetrics', () => {
  it('handles a customer with no orders', () => {
    const m = computeCustomerMetrics({ ...base, orders: [] })
    expect(m.numberOfOrders).toBe(0)
    expect(m.totalSpending).toBe(0)
    expect(m.isRepeatCustomer).toBe(false)
    expect(m.daysSinceLastOrder).toBeNull()
    expect(m.firstOrderDate).toBeNull()
    expect(m.purchasesPerMonth).toBeNull()
  })
  it('counts only completed orders', () => {
    const m = computeCustomerMetrics({
      ...base,
      orders: [
        { orderDate: '2026-09-01', status: 'completed', total: 50 },
        { orderDate: '2026-09-10', status: 'cancelled', total: 999 },
        { orderDate: '2026-09-27', status: 'preparing', total: 40 },
      ],
    })
    expect(m.numberOfOrders).toBe(1)
    expect(m.totalSpending).toBe(50)
    expect(m.openOrders).toBe(1)
    expect(m.isRepeatCustomer).toBe(false)
  })
  it('flags a repeat customer (more than one completed order)', () => {
    const m = computeCustomerMetrics({
      ...base,
      orders: [
        { orderDate: '2026-08-01', status: 'completed', total: 30 },
        { orderDate: '2026-09-20', status: 'completed', total: 45.5 },
      ],
    })
    expect(m.isRepeatCustomer).toBe(true)
    expect(m.totalSpending).toBe(75.5)
    expect(m.firstOrderDate).toBe('2026-08-01')
    expect(m.lastOrderDate).toBe('2026-09-20')
    expect(m.daysSinceLastOrder).toBe(8)
  })
  it('measures purchase frequency over the active period, minimum one month', () => {
    const recent = computeCustomerMetrics({ ...base, orders: [{ orderDate: '2026-09-20', status: 'completed', total: 10 }] })
    expect(recent.purchasesPerMonth).toBe(1) // 1 order over max(8 days, 1 month)
    const longer = computeCustomerMetrics({
      ...base,
      orders: [
        { orderDate: '2026-06-30', status: 'completed', total: 10 }, // 90 days before today = 3 months
        { orderDate: '2026-07-30', status: 'completed', total: 10 },
        { orderDate: '2026-08-30', status: 'completed', total: 10 },
        { orderDate: '2026-09-15', status: 'completed', total: 10 },
        { orderDate: '2026-09-20', status: 'completed', total: 10 },
        { orderDate: '2026-09-25', status: 'completed', total: 10 },
      ],
    })
    expect(longer.numberOfOrders).toBe(6)
    expect(longer.purchasesPerMonth).toBe(2) // 6 orders over exactly 3 months
  })
  it('never reports negative days since last order', () => {
    const m = computeCustomerMetrics({ ...base, orders: [{ orderDate: '2026-10-05', status: 'completed', total: 10 }] })
    expect(m.daysSinceLastOrder).toBe(0)
  })
  it('ignores non-finite totals instead of corrupting spending', () => {
    const m = computeCustomerMetrics({ ...base, orders: [{ orderDate: '2026-09-01', status: 'completed', total: NaN }, { orderDate: '2026-09-02', status: 'completed', total: 20 }] })
    expect(m.totalSpending).toBe(20)
  })
})

describe('daysBetweenISO', () => {
  it('counts whole days across month ends and leap years', () => {
    expect(daysBetweenISO('2026-09-20', '2026-09-28')).toBe(8)
    expect(daysBetweenISO('2026-02-27', '2026-03-01')).toBe(2)
    expect(daysBetweenISO('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetweenISO('2026-09-28', '2026-09-20')).toBe(-8)
  })
})
