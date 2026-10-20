import { describe, it, expect } from 'vitest'
import { bestStreak, isChecklistPlatform, postingStreak, postSuggestion } from '@/lib/content'
import type { ContentPlatform } from '@/lib/supabase/database.types'

const all = new Set<ContentPlatform>(['instagram', 'facebook', 'whatsapp'])
const days = ['2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29']

describe('postingStreak', () => {
  it('counts consecutive complete days ending today', () => {
    const posted = new Map([[days[0]!, all], [days[1]!, all], [days[3]!, all]])
    expect(postingStreak(days, posted)).toBe(2)
  })

  it('does not break the streak while today is still in progress', () => {
    const posted = new Map([[days[0]!, new Set<ContentPlatform>(['instagram'])], [days[1]!, all], [days[2]!, all]])
    expect(postingStreak(days, posted)).toBe(2)
  })

  it('needs every platform for a day to count', () => {
    const posted = new Map([[days[1]!, new Set<ContentPlatform>(['instagram', 'facebook'])]])
    expect(postingStreak(days, posted)).toBe(0)
  })
})

describe('bestStreak', () => {
  it('finds the longest run of complete days, across months', () => {
    const posted = new Map([
      ['2026-09-29', all],
      ['2026-09-30', all],
      ['2026-10-01', all],
      ['2026-10-03', all],
      ['2026-10-04', new Set<ContentPlatform>(['instagram'])],
    ])
    expect(bestStreak(posted)).toBe(3)
    expect(bestStreak(new Map())).toBe(0)
  })
})

describe('postSuggestion', () => {
  const stock = (name: string, readyStock: number, category: string | null = null, imageUrl: string | null = null) => ({ name, category, imageUrl, readyStock })

  it('suggests what is on the shelf first, telling same-named products apart', () => {
    const s = postSuggestion({
      readyStock: [stock('Chocolate 8″', 4, 'Batik Cake Klasik', 'https://x/a.jpg'), stock('Chocolate 8″', 2, 'Batik Cake Indulgence'), stock('Gone', 0)],
      bestSeller: { name: 'Klasik 8″', quantity: 9 },
      isoDate: '2026-10-20',
    })
    expect(s.title).toBe('Post what’s ready')
    expect(s.text).toContain('4× Chocolate 8″ (Batik Cake Klasik), 2× Chocolate 8″ (Batik Cake Indulgence)')
    expect(s.text).not.toContain('Gone')
    expect(s.imageUrl).toBe('https://x/a.jpg')
  })

  it('falls back to the best seller, then to a daily idea', () => {
    expect(postSuggestion({ readyStock: [stock('Gone', 0)], bestSeller: { name: 'Klasik 8″', quantity: 9 }, isoDate: '2026-10-20' }).text).toContain(
      'Klasik 8″ is your best seller'
    )
    const a = postSuggestion({ readyStock: [], bestSeller: null, isoDate: '2026-10-20' })
    const b = postSuggestion({ readyStock: [], bestSeller: null, isoDate: '2026-10-21' })
    expect(a.title).not.toBe(b.title)
    expect(postSuggestion({ readyStock: [], bestSeller: null, isoDate: '2026-10-20' })).toEqual(a)
  })
})

describe('isChecklistPlatform', () => {
  it('accepts only the three checklist platforms', () => {
    expect(isChecklistPlatform('instagram')).toBe(true)
    expect(isChecklistPlatform('tiktok')).toBe(false)
  })
})
