// ============================================================================
// Deterministic task recommendation engine (spec §12). No AI.
//
// getNextRecommendedTask() is a PURE function: same input, same output, no
// database or clock access. The Today screen fetches the data and passes it in,
// which keeps the rules easy to test and to explain.
//
// Rule order (first match wins):
//   1. An urgent (due soon or overdue) customer order        → the order
//   2. An overdue HIGH-priority task                          → that task
//   3. A task already in progress                             → finish it
//   4. The next unfinished task in the current schedule block → that task
//        (an empty block, e.g. Break, is reported as such)
//   5. An unfinished "today's priority" task                  → that task
//   6. An item at/below its reorder level                     → reorder it
//   7. Otherwise                                              → the next block, or "all done"
// Every result carries a plain-language `reason` (spec §12).
// ============================================================================

import type { OrderStatus } from '@/lib/supabase/database.types'
import { formatDuration, formatTime12, timeToMinutes } from '@/lib/time'
import type { RecommendedTask } from './types'
import {
  getBlockCandidates,
  getCurrentBlock,
  getNextBlock,
  isOpen,
  type ScheduleBlockLike,
  type TaskLike,
} from './schedule'

/** An order due within this many minutes (or already late) is "urgent". */
export const URGENT_ORDER_WINDOW_MINUTES = 180
/** Tasks with priority >= this are "high priority" (0 normal, 1 medium, 2 high). */
export const HIGH_PRIORITY = 2

const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready']

export function isActiveOrder(status: OrderStatus): boolean {
  return ACTIVE_ORDER_STATUSES.includes(status)
}

export interface EngineOrder {
  id: string
  customerName: string | null
  requiredDate: string | null
  requiredTime: string | null
  status: OrderStatus
}

export interface EngineInventoryAlert {
  id: string
  name: string
  currentQuantity: number
  unit: string
  reorderLevel: number
}

export interface EngineInput {
  /** Business-local date, YYYY-MM-DD */
  today: string
  /** Business-local time, HH:mm */
  time: string
  blocks: ScheduleBlockLike[]
  tasks: TaskLike[]
  orders: EngineOrder[]
  inventoryAlerts: EngineInventoryAlert[]
  urgentOrderWindowMinutes?: number
}

export interface OrderUrgency {
  isUrgent: boolean
  isOverdue: boolean
  minutesUntilDue: number | null
}

export function getOrderUrgency(
  order: EngineOrder,
  today: string,
  time: string,
  windowMinutes: number = URGENT_ORDER_WINDOW_MINUTES
): OrderUrgency {
  const none: OrderUrgency = { isUrgent: false, isOverdue: false, minutesUntilDue: null }
  if (!isActiveOrder(order.status) || !order.requiredDate) return none
  if (order.requiredDate < today) return { isUrgent: true, isOverdue: true, minutesUntilDue: null }
  // Due on a later day, or due today with no time given → shown, but not "urgent".
  if (order.requiredDate > today || !order.requiredTime) return none
  const minutes = timeToMinutes(order.requiredTime) - timeToMinutes(time)
  return { isUrgent: minutes <= windowMinutes, isOverdue: minutes < 0, minutesUntilDue: minutes }
}

export function isOverdueTask(task: TaskLike, today: string, time: string): boolean {
  if (!isOpen(task.status) || !task.scheduledDate) return false
  if (task.scheduledDate < today) return true
  return task.scheduledDate === today && task.scheduledTime !== null && task.scheduledTime.slice(0, 5) < time
}

const STATUS_RANK = { in_progress: 0, not_started: 1, paused: 2, completed: 9, skipped: 9 } as const

/** Best unfinished task: in-progress first, then not started, then paused; then today's priorities; then priority; then order. */
export function pickNextOpenTask(tasks: TaskLike[]): TaskLike | null {
  const open = tasks.filter((t) => isOpen(t.status))
  open.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      (a.dailyPriorityRank ?? 99) - (b.dailyPriorityRank ?? 99) ||
      b.priority - a.priority ||
      a.sortOrder - b.sortOrder ||
      a.title.localeCompare(b.title)
  )
  return open[0] ?? null
}

function range(block: ScheduleBlockLike): string {
  return `${formatTime12(block.startTime)}–${formatTime12(block.endTime)}`
}

function orderRecommendation(order: EngineOrder, urgency: OrderUrgency): RecommendedTask {
  const name = order.customerName ?? 'a customer'
  const suffix = "Customer orders always come first."
  let reason: string
  if (urgency.isOverdue && order.requiredTime && order.requiredDate && urgency.minutesUntilDue !== null) {
    reason = `Order for ${name} was due at ${formatTime12(order.requiredTime)} and isn't completed yet. ${suffix}`
  } else if (urgency.isOverdue) {
    reason = `Order for ${name} was due on ${order.requiredDate} and isn't completed yet. ${suffix}`
  } else {
    const time = order.requiredTime ? formatTime12(order.requiredTime) : 'later today'
    reason = `Order for ${name} is due at ${time} (in ${formatDuration(urgency.minutesUntilDue ?? 0)}). ${suffix}`
  }
  return {
    taskId: null,
    orderId: order.id,
    title: order.status === 'ready' ? `Hand over order for ${name}` : `Fulfil order for ${name}`,
    reason,
    category: 'orders',
    source: 'urgent_order',
  }
}

function taskRecommendation(
  task: TaskLike,
  source: RecommendedTask['source'],
  reason: string
): RecommendedTask {
  return { taskId: task.id, orderId: null, title: task.title, reason, category: task.category, source }
}

export function getNextRecommendedTask(input: EngineInput): RecommendedTask {
  const { today, time, blocks, tasks, orders, inventoryAlerts } = input
  const windowMinutes = input.urgentOrderWindowMinutes ?? URGENT_ORDER_WINDOW_MINUTES

  // 1. Urgent customer order (overdue first, then the earliest due).
  const urgentOrders = orders
    .flatMap((order) => {
      const urgency = getOrderUrgency(order, today, time, windowMinutes)
      return urgency.isUrgent ? [{ order, urgency }] : []
    })
    .sort(
      (a, b) =>
        Number(b.urgency.isOverdue) - Number(a.urgency.isOverdue) ||
        (a.order.requiredDate ?? '').localeCompare(b.order.requiredDate ?? '') ||
        (a.order.requiredTime ?? '').localeCompare(b.order.requiredTime ?? '')
    )
  const firstUrgent = urgentOrders[0]
  if (firstUrgent) return orderRecommendation(firstUrgent.order, firstUrgent.urgency)

  // 2. Overdue high-priority task.
  const overdue = tasks
    .filter((t) => t.priority >= HIGH_PRIORITY && isOverdueTask(t, today, time))
    .sort(
      (a, b) =>
        (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '') ||
        (a.scheduledTime ?? '').localeCompare(b.scheduledTime ?? '') ||
        b.priority - a.priority
    )[0]
  if (overdue) {
    const due = overdue.scheduledDate === today && overdue.scheduledTime ? `at ${formatTime12(overdue.scheduledTime)} today` : `on ${overdue.scheduledDate}`
    return taskRecommendation(overdue, 'overdue_task', `"${overdue.title}" is high priority and was due ${due}.`)
  }

  // 3. A task already started — finish what you began.
  const started = tasks.filter((t) => t.status === 'in_progress').sort((a, b) => a.sortOrder - b.sortOrder)[0]
  if (started) {
    return taskRecommendation(started, 'in_progress_task', `You already started "${started.title}" — finish it before moving on.`)
  }

  // 4. Current schedule block.
  const block = getCurrentBlock(blocks, time)
  const next = getNextBlock(blocks, time)
  if (block) {
    const candidates = getBlockCandidates(block, tasks, today)
    if (candidates.length === 0) {
      const after = next
        ? `${next.title} starts at ${formatTime12(next.startTime)}.`
        : 'Nothing else is planned after this.'
      return {
        taskId: null,
        orderId: null,
        title: block.title,
        reason: `${block.title} (${range(block)}) is scheduled right now and has no tasks. ${after}`,
        category: block.category,
        source: 'schedule_block',
      }
    }
    const pick = pickNextOpenTask(candidates)
    if (pick) {
      const priorityNote = pick.dailyPriorityRank ? ` It is also priority #${pick.dailyPriorityRank} for today.` : ''
      return taskRecommendation(
        pick,
        'schedule_block',
        `Your current schedule block, ${block.title} (${range(block)}), is running, and this is its next unfinished task.${priorityNote}`
      )
    }
  }

  // 5. Unfinished "today's priority" task.
  const priority = tasks
    .filter((t) => t.dailyPriorityRank !== null && t.scheduledDate === today && isOpen(t.status))
    .sort((a, b) => (a.dailyPriorityRank ?? 99) - (b.dailyPriorityRank ?? 99))[0]
  if (priority) {
    const lead = block ? `Nothing else is left in ${block.title}, so` : 'Nothing is scheduled right now, so'
    return taskRecommendation(priority, 'daily_priority', `${lead} continue with priority #${priority.dailyPriorityRank} for today.`)
  }

  // 6. Low inventory.
  const alert = [...inventoryAlerts].sort(
    (a, b) => a.currentQuantity / Math.max(a.reorderLevel, 1) - b.currentQuantity / Math.max(b.reorderLevel, 1)
  )[0]
  if (alert) {
    return {
      taskId: null,
      orderId: null,
      title: `Reorder ${alert.name}`,
      reason: `${alert.name} is at ${alert.currentQuantity} ${alert.unit}, at or below its reorder level of ${alert.reorderLevel} ${alert.unit}.`,
      category: 'inventory',
      source: 'inventory_alert',
    }
  }

  // 7. Next scheduled block, or nothing left.
  if (next) {
    return {
      taskId: null,
      orderId: null,
      title: next.title,
      reason: `Nothing is scheduled right now. ${next.title} starts at ${formatTime12(next.startTime)}.`,
      category: next.category,
      source: 'next_scheduled',
    }
  }
  if (blocks.length === 0) {
    return {
      taskId: null,
      orderId: null,
      title: 'Set up your daily schedule',
      reason: "You don't have any schedule blocks yet. Add them in Settings → Daily schedule.",
      category: 'business',
      source: 'all_done',
    }
  }
  return {
    taskId: null,
    orderId: null,
    title: "Today's plan is complete",
    reason: 'Everything scheduled for today is done. Use the time to plan tomorrow or improve something.',
    category: 'business',
    source: 'all_done',
  }
}
