import { describe, it, expect } from 'vitest'
import { isChecklistPlatform, postingStreak } from '@/lib/content'
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

describe('isChecklistPlatform', () => {
  it('accepts only the three checklist platforms', () => {
    expect(isChecklistPlatform('instagram')).toBe(true)
    expect(isChecklistPlatform('tiktok')).toBe(false)
  })
})
