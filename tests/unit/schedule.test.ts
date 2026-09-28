import { describe, it, expect } from 'vitest'
import { getBlockCandidates, getBlockProgress, getCurrentBlock, getNextBlock } from '@/lib/services/schedule'
import { BLOCKS, task } from './helpers'

describe('getCurrentBlock / getNextBlock', () => {
  it('finds the block containing the time', () => {
    expect(getCurrentBlock(BLOCKS, '11:42')?.id).toBe('b-prod')
  })
  it('includes the start boundary and excludes the end boundary', () => {
    expect(getCurrentBlock(BLOCKS, '11:30')?.id).toBe('b-prod')
    expect(getCurrentBlock(BLOCKS, '13:00')?.id).toBe('b-content')
  })
  it('returns null outside all blocks', () => {
    expect(getCurrentBlock(BLOCKS, '10:00')).toBeNull()
    expect(getCurrentBlock(BLOCKS, '20:00')).toBeNull()
  })
  it('works even when blocks are given out of order', () => {
    expect(getCurrentBlock([...BLOCKS].reverse(), '13:10')?.id).toBe('b-content')
  })
  it('finds the next block that starts after now', () => {
    expect(getNextBlock(BLOCKS, '11:42')?.id).toBe('b-content')
    expect(getNextBlock(BLOCKS, '10:00')?.id).toBe('b-open')
    expect(getNextBlock(BLOCKS, '14:45')).toBeNull()
  })
})

describe('getBlockCandidates', () => {
  const prod = BLOCKS[1]!
  it('includes tasks generated from the block', () => {
    const t = task({ id: 'a', scheduleBlockId: 'b-prod' })
    expect(getBlockCandidates(prod, [t], '2026-09-28')).toHaveLength(1)
  })
  it('excludes tasks that belong to a different block', () => {
    expect(getBlockCandidates(prod, [task({ id: 'a', scheduleBlockId: 'b-open' })], '2026-09-28')).toHaveLength(0)
  })
  it('includes a manual task scheduled inside the block window', () => {
    const t = task({ id: 'm', source: 'manual', scheduledTime: '12:00:00', category: 'marketing' })
    expect(getBlockCandidates(prod, [t], '2026-09-28')).toHaveLength(1)
  })
  it('includes an untimed manual task only when the category matches', () => {
    const match = task({ id: 'm1', source: 'manual', category: 'production' })
    const other = task({ id: 'm2', source: 'manual', category: 'marketing' })
    expect(getBlockCandidates(prod, [match, other], '2026-09-28').map((t) => t.id)).toEqual(['m1'])
  })
  it('never pulls a daily-priority task in by category', () => {
    const t = task({ id: 'p', source: 'manual', category: 'production', dailyPriorityRank: 1 })
    expect(getBlockCandidates(prod, [t], '2026-09-28')).toHaveLength(0)
  })
  it('ignores manual tasks scheduled for another day', () => {
    const t = task({ id: 'm', source: 'manual', category: 'production', scheduledDate: '2026-09-27' })
    expect(getBlockCandidates(prod, [t], '2026-09-28')).toHaveLength(0)
  })
})

describe('getBlockProgress', () => {
  const prod = BLOCKS[1]!
  it('is task-based: completed and skipped both count as done', () => {
    const tasks = [
      task({ id: 'a', status: 'completed' }),
      task({ id: 'b', status: 'skipped' }),
      task({ id: 'c' }),
      task({ id: 'd', status: 'in_progress' }),
    ]
    const p = getBlockProgress(prod, tasks, '12:00')
    expect(p.percent).toBe(50)
    expect(p.label).toBe('2 of 4 tasks done')
    expect(p.basis).toBe('tasks')
  })
  it('is time-based for a block with no tasks', () => {
    const p = getBlockProgress(BLOCKS[3]!, [], '14:15')
    expect(p.basis).toBe('time')
    expect(p.percent).toBe(50)
    expect(p.label).toBe('15 min left')
  })
  it('never goes outside 0–100', () => {
    expect(getBlockProgress(BLOCKS[3]!, [], '13:00').percent).toBe(0)
    expect(getBlockProgress(BLOCKS[3]!, [], '15:00').percent).toBe(100)
  })
})
