import { describe, it, expect } from 'vitest'
import { normalizeSocialLink, socialHandle } from '@/lib/social'

describe('normalizeSocialLink', () => {
  it('turns handles and bare addresses into clean links', () => {
    expect(normalizeSocialLink('instagram', '@adikakakbites')).toEqual({ ok: true, url: 'https://www.instagram.com/adikakakbites' })
    expect(normalizeSocialLink('instagram', 'instagram.com/adikakakbites/')).toEqual({ ok: true, url: 'https://www.instagram.com/adikakakbites' })
    expect(normalizeSocialLink('tiktok', 'adikakak.bites')).toEqual({ ok: true, url: 'https://www.tiktok.com/@adikakak.bites' })
    expect(normalizeSocialLink('tiktok', 'https://www.tiktok.com/@adikakak')).toEqual({ ok: true, url: 'https://www.tiktok.com/@adikakak' })
    expect(normalizeSocialLink('facebook', 'https://m.facebook.com/AdikakakBites?ref=x')).toEqual({ ok: true, url: 'https://www.facebook.com/AdikakakBites' })
  })

  it('treats blank as "no link" and refuses other sites', () => {
    expect(normalizeSocialLink('instagram', '  ')).toEqual({ ok: true, url: null })
    expect(normalizeSocialLink('instagram', 'https://evil.example.com/x').ok).toBe(false)
    expect(normalizeSocialLink('facebook', 'facebook.com').ok).toBe(false)
  })

  it('shows a saved link as its handle', () => {
    expect(socialHandle('https://www.instagram.com/adikakakbites')).toBe('@adikakakbites')
    expect(socialHandle('https://www.tiktok.com/@adikakak')).toBe('@adikakak')
    expect(socialHandle(null)).toBe('')
  })
})
