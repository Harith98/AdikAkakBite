import { describe, it, expect } from 'vitest'
import { dayHeadline, dayPart } from '@/lib/today-greeting'

const base = { overdueOrders: 0, ordersDueToday: 0, lowStock: 0, ordersComingUp: 0, isWorkingDay: true, isoDate: '2026-10-20' }

describe('dayPart', () => {
  it('follows the clock', () => {
    expect(dayPart('07:30').greeting).toBe('Good morning')
    expect(dayPart('13:05').emoji).toBe('🌤️')
    expect(dayPart('18:40').greeting).toBe('Good evening')
    expect(dayPart('23:10').greeting).toBe('Good night')
    expect(dayPart('03:00').greeting).toBe('Good night')
  })
})

describe('dayHeadline', () => {
  it('puts the most pressing thing first', () => {
    expect(dayHeadline({ ...base, overdueOrders: 1, ordersDueToday: 3 })).toMatch(/1 order is overdue/)
    expect(dayHeadline({ ...base, ordersDueToday: 3, lowStock: 2 })).toBe('🧾 3 orders due today. You’ve got this!')
    expect(dayHeadline({ ...base, lowStock: 1 })).toBe('📦 1 item needs restocking soon.')
  })

  it('looks ahead to the week when today is clear', () => {
    expect(dayHeadline({ ...base, ordersComingUp: 4 })).toBe('📅 4 orders coming up this week. Plan your baking!')
    expect(dayHeadline({ ...base, ordersComingUp: 1 })).toBe('📅 1 order coming up this week. Plan your baking!')
    expect(dayHeadline({ ...base, ordersDueToday: 2, ordersComingUp: 4 })).toMatch(/due today/)
  })

  it('has a calm line for days off and quiet days, the same all day', () => {
    expect(dayHeadline({ ...base, isWorkingDay: false })).toMatch(/day off/)
    const quiet = dayHeadline(base)
    expect(dayHeadline(base)).toBe(quiet)
    expect(dayHeadline({ ...base, isoDate: '2026-10-21' })).not.toBe(quiet)
  })
})
