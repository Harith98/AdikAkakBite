import { describe, it, expect } from 'vitest'
import { fetchAllPages, isMissingFunction, PAGE_SIZE } from '@/lib/services/db-helpers'

/** A fake table of `total` rows that, like Supabase, returns at most PAGE_SIZE per request. */
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }))
  const calls: [number, number][] = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    return { data: rows.slice(from, Math.min(to + 1, from + PAGE_SIZE)), error: null }
  }
  return { page, calls }
}

describe('fetchAllPages', () => {
  it('collects every row past the 1000-row limit, without gaps or repeats', async () => {
    const { page, calls } = fakeTable(2345)
    const rows = await fetchAllPages<{ id: number }>(page)
    expect(rows).toHaveLength(2345)
    expect(new Set(rows.map((r) => r.id)).size).toBe(2345)
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('handles an exact multiple of the page size and an empty table', async () => {
    expect(await fetchAllPages(fakeTable(2000).page)).toHaveLength(2000)
    expect(await fetchAllPages(fakeTable(0).page)).toEqual([])
  })

  it('fails loudly instead of returning part of the data', async () => {
    let n = 0
    const flaky = async () => (++n === 2 ? { data: null, error: { message: 'connection lost' } } : { data: Array(PAGE_SIZE).fill({}), error: null })
    await expect(fetchAllPages(flaky)).rejects.toThrow('connection lost')
  })
})

describe('isMissingFunction', () => {
  it('spots a database function that has not been added yet', () => {
    expect(isMissingFunction({ code: 'PGRST202', message: 'x' })).toBe(true)
    expect(isMissingFunction({ message: 'Could not find the function public.save_recipe(...) in the schema cache' })).toBe(true)
    expect(isMissingFunction({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingFunction(null)).toBe(false)
  })
})
