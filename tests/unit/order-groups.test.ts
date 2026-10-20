import { describe, it, expect } from 'vitest'
import { dueGroupOf, groupOrdersByDue, upcomingByDay } from '@/lib/order-groups'

const today = '2026-10-20' // a Tuesday

describe('dueGroupOf', () => {
  it('buckets by days from today', () => {
    expect(dueGroupOf('2026-10-19', today)).toBe('overdue')
    expect(dueGroupOf('2026-10-20', today)).toBe('today')
    expect(dueGroupOf('2026-10-21', today)).toBe('tomorrow')
    expect(dueGroupOf('2026-10-27', today)).toBe('this_week')
    expect(dueGroupOf('2026-11-03', today)).toBe('next_week')
    expect(dueGroupOf('2026-12-20', today)).toBe('later')
    expect(dueGroupOf(null, today)).toBe('no_date')
  })
})

describe('groupOrdersByDue', () => {
  it('returns only non-empty groups, in time order, keeping the incoming order', () => {
    const orders = [
      { id: 'a', requiredDate: '2026-10-21' },
      { id: 'b', requiredDate: null },
      { id: 'c', requiredDate: '2026-10-18' },
      { id: 'd', requiredDate: '2026-10-21' },
    ]
    expect(groupOrdersByDue(orders, today).map((g) => [g.key, g.orders.map((o) => o.id)])).toEqual([
      ['overdue', ['c']],
      ['tomorrow', ['a', 'd']],
      ['no_date', ['b']],
    ])
  })
})

describe('upcomingByDay', () => {
  it('lists tomorrow through 7 days ahead, one entry per day', () => {
    const days = upcomingByDay(
      [
        { id: 'today', requiredDate: '2026-10-20' },
        { id: 'fri', requiredDate: '2026-10-23' },
        { id: 'tue2', requiredDate: '2026-10-27' },
        { id: 'tmrw', requiredDate: '2026-10-21' },
        { id: 'far', requiredDate: '2026-10-28' },
      ],
      today
    )
    expect(days.map((d) => d.date)).toEqual(['2026-10-21', '2026-10-23', '2026-10-27'])
    expect(days[0]?.label.startsWith('Tomorrow · ')).toBe(true)
  })
})
