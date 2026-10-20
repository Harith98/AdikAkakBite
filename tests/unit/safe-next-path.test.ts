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

describe('menu address', () => {
  it('reads the menu host from NEXT_PUBLIC_MENU_URL and falls back to /menu', async () => {
    const original = process.env.NEXT_PUBLIC_MENU_URL
    const { menuHostname, menuUrl } = await import('@/lib/site-url')
    process.env.NEXT_PUBLIC_MENU_URL = 'https://AdikAkak-Menu.vercel.app/'
    expect(menuHostname()).toBe('adikakak-menu.vercel.app')
    expect(menuUrl()).toBe('https://adikakak-menu.vercel.app')
    process.env.NEXT_PUBLIC_MENU_URL = ''
    expect(menuHostname()).toBeNull()
    expect(menuUrl().endsWith('/menu')).toBe(true)
    process.env.NEXT_PUBLIC_MENU_URL = 'not a url'
    expect(menuHostname()).toBeNull()
    process.env.NEXT_PUBLIC_MENU_URL = original
  })
})
