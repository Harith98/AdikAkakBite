import { describe, it, expect } from 'vitest'
import { formatMoney, formatPercent } from '@/lib/constants'
import { isTimeWithin } from '@/lib/time'

describe('formatMoney', () => {
  it('formats MYR with the RM prefix and two decimals', () => {
    expect(formatMoney(280, 'MYR')).toBe('RM 280.00')
  })

  it('handles zero', () => {
    expect(formatMoney(0, 'MYR')).toBe('RM 0.00')
  })

  it('falls back to Intl formatting for other currencies', () => {
    expect(formatMoney(19.99, 'USD')).toBe('$19.99')
  })
})

describe('formatPercent', () => {
  it('formats without a sign by default', () => {
    expect(formatPercent(14.2)).toBe('14.2%')
  })

  it('adds a + sign for positive values when signed is requested', () => {
    expect(formatPercent(14.2, { signed: true })).toBe('+14.2%')
  })

  it('does not add a + sign for negative values', () => {
    expect(formatPercent(-5.5, { signed: true })).toBe('-5.5%')
  })
})

describe('isTimeWithin', () => {
  it('is true for a time inside the range', () => {
    expect(isTimeWithin('11:42', '11:30', '13:00')).toBe(true)
  })

  it('is true exactly at the start boundary (inclusive)', () => {
    expect(isTimeWithin('11:30', '11:30', '13:00')).toBe(true)
  })

  it('is false exactly at the end boundary (exclusive)', () => {
    expect(isTimeWithin('13:00', '11:30', '13:00')).toBe(false)
  })

  it('is false before the range', () => {
    expect(isTimeWithin('09:00', '11:30', '13:00')).toBe(false)
  })

  it('is false after the range', () => {
    expect(isTimeWithin('20:15', '11:30', '13:00')).toBe(false)
  })
})
