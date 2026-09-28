import { describe, it, expect } from 'vitest'
import { getSuggestedPriorities } from '@/lib/services/priorities'
import { order, task } from './helpers'

const base = { today: '2026-09-28', time: '11:00', orders: [], inventoryAlerts: [], tasks: [], existingTitles: [] }

describe('getSuggestedPriorities', () => {
  it('returns nothing for a business with no data', () => {
    expect(getSuggestedPriorities(base)).toEqual([])
  })
  it('suggests fulfilling orders due today, with the time', () => {
    const s = getSuggestedPriorities({ ...base, orders: [order({ id: 'o1', requiredTime: '16:00' })] })
    expect(s[0]?.title).toBe("Fulfil Sarah's order (4:00 PM)")
  })
  it('does not suggest completed orders', () => {
    expect(getSuggestedPriorities({ ...base, orders: [order({ id: 'o1', status: 'completed' })] })).toEqual([])
  })
  it('suggests reordering low-stock items', () => {
    const s = getSuggestedPriorities({
      ...base,
      inventoryAlerts: [{ id: 'i', name: 'Chocolate', currentQuantity: 1, unit: 'kg', reorderLevel: 2 }],
    })
    expect(s[0]?.title).toBe('Reorder Chocolate')
  })
  it('does not repeat a priority the owner already set (case-insensitive)', () => {
    const s = getSuggestedPriorities({
      ...base,
      inventoryAlerts: [{ id: 'i', name: 'Chocolate', currentQuantity: 1, unit: 'kg', reorderLevel: 2 }],
      existingTitles: ['reorder chocolate'],
    })
    expect(s).toEqual([])
  })
  it('never returns more than three', () => {
    const orders = [1, 2, 3, 4].map((n) => order({ id: `o${n}`, customerName: `C${n}` }))
    const overdue = [1, 2, 3].map((n) => task({ id: `t${n}`, priority: 2, scheduledDate: '2026-09-20' }))
    expect(getSuggestedPriorities({ ...base, orders, tasks: overdue }).length).toBeLessThan(4)
  })
})
