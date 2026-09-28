import type { TaskSource, TaskStatus } from '@/lib/supabase/database.types'
import { isTimeWithin, timeToMinutes } from '@/lib/time'

export interface ScheduleBlockLike {
  id: string
  title: string
  category: string
  /** "HH:mm" */
  startTime: string
  endTime: string
  sortOrder: number
}

export interface TaskLike {
  id: string
  title: string
  category: string
  priority: number
  status: TaskStatus
  scheduledDate: string | null
  scheduledTime: string | null
  scheduleBlockId: string | null
  sortOrder: number
  dailyPriorityRank: number | null
  source: TaskSource
  orderId: string | null
}

export const OPEN_STATUSES: readonly TaskStatus[] = ['not_started', 'in_progress', 'paused']

export function isOpen(status: TaskStatus): boolean {
  return OPEN_STATUSES.includes(status)
}

function byStart<T extends ScheduleBlockLike>(a: T, b: T): number {
  return a.startTime.localeCompare(b.startTime)
}

export function getCurrentBlock<T extends ScheduleBlockLike>(blocks: T[], time: string): T | null {
  return [...blocks].sort(byStart).find((b) => isTimeWithin(time, b.startTime, b.endTime)) ?? null
}

export function getNextBlock<T extends ScheduleBlockLike>(blocks: T[], time: string): T | null {
  return [...blocks].sort(byStart).find((b) => b.startTime.slice(0, 5) > time) ?? null
}

/**
 * Every task that belongs to a block, in display order:
 *  - tasks generated from the block (schedule_block_id matches), plus
 *  - today's manual tasks with no block that either fall inside the block's
 *    time window, or have no time and share the block's category.
 * Daily-priority tasks are excluded from the category match on purpose: they
 * are surfaced by the priorities logic, not by whichever block shares a category.
 */
export function getBlockCandidates(block: ScheduleBlockLike, tasks: TaskLike[], today: string): TaskLike[] {
  return tasks
    .filter((t) => {
      if (t.scheduleBlockId === block.id) return true
      if (t.scheduleBlockId !== null) return false
      if (t.scheduledDate !== today) return false
      if (t.scheduledTime) return isTimeWithin(t.scheduledTime.slice(0, 5), block.startTime, block.endTime)
      return t.dailyPriorityRank === null && t.category === block.category
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
}

export interface BlockProgress {
  percent: number
  label: string
  basis: 'tasks' | 'time'
}

/**
 * Task-based when the block has tasks (completed + skipped count as done);
 * otherwise time-based (e.g. the Break block, which has no tasks).
 */
export function getBlockProgress(block: ScheduleBlockLike, blockTasks: TaskLike[], time: string): BlockProgress {
  const total = blockTasks.length
  if (total > 0) {
    const done = blockTasks.filter((t) => t.status === 'completed' || t.status === 'skipped').length
    return { percent: Math.round((done / total) * 100), label: `${done} of ${total} tasks done`, basis: 'tasks' }
  }
  const start = timeToMinutes(block.startTime)
  const end = timeToMinutes(block.endTime)
  const now = timeToMinutes(time)
  const span = Math.max(end - start, 1)
  const elapsed = Math.min(Math.max(now - start, 0), span)
  return {
    percent: Math.round((elapsed / span) * 100),
    label: `${Math.max(end - now, 0)} min left`,
    basis: 'time',
  }
}
