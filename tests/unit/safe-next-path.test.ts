import { describe, it, expect } from 'vitest'
import { safeNextPath } from '@/lib/validation/common'

describe('safeNextPath', () => {
  it('keeps same-origin paths', () => {
    expect(safeNextPath('/orders/new')).toBe('/orders/new')
    expect(safeNextPath('/orders?status=all')).toBe('/orders?status=all')
  })

  it('falls back for missing or off-site targets', () => {
    expect(safeNextPath(null)).toBe('/today')
    expect(safeNextPath('')).toBe('/today')
    expect(safeNextPath('https://evil.example')).toBe('/today')
    expect(safeNextPath('//evil.example')).toBe('/today')
    expect(safeNextPath('/\\evil.example')).toBe('/today')
    expect(safeNextPath('@evil.example')).toBe('/today')
  })
})
