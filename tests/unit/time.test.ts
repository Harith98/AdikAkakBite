import { describe, it, expect } from 'vitest'
import { formatDuration, formatTime12, getBusinessNow, timeToMinutes } from '@/lib/time'

describe('getBusinessNow', () => {
  it('uses the business timezone for the date (UTC+8 crosses midnight early)', () => {
    const now = getBusinessNow('Asia/Kuala_Lumpur', new Date('2026-09-28T16:30:00Z'))
    expect(now.isoDate).toBe('2026-09-29')
    expect(now.time).toBe('00:30')
  })
  it('never reports 24:xx at midnight', () => {
    const now = getBusinessNow('Asia/Kuala_Lumpur', new Date('2026-09-28T16:05:00Z'))
    expect(now.time).toBe('00:05')
  })
  it('reports the correct weekday (Mon=1..Sun=7)', () => {
    expect(getBusinessNow('Asia/Kuala_Lumpur', new Date('2026-09-28T04:00:00Z')).isoWeekday).toBe(1) // Monday
    expect(getBusinessNow('Asia/Kuala_Lumpur', new Date('2026-10-04T04:00:00Z')).isoWeekday).toBe(7) // Sunday
  })
})

describe('time formatting', () => {
  it('timeToMinutes handles HH:mm and HH:mm:ss', () => {
    expect(timeToMinutes('11:30')).toBe(690)
    expect(timeToMinutes('16:00:00')).toBe(960)
  })
  it('formatTime12', () => {
    expect(formatTime12('16:00:00')).toBe('4:00 PM')
    expect(formatTime12('00:05')).toBe('12:05 AM')
    expect(formatTime12('12:00')).toBe('12:00 PM')
    expect(formatTime12('11:30')).toBe('11:30 AM')
  })
  it('formatDuration', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(90)).toBe('1 h 30 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(-5)).toBe('0 min')
  })
})
