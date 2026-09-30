/**
 * What each phone notification says. Pure functions (no I/O) so the wording
 * and the "should we notify?" rules can be unit-tested; sending lives in push.ts.
 */
import { needsReorder, type InventoryStatusValue } from '@/lib/calc/inventory'
import { formatDateShort, formatTime12 } from '@/lib/time'

export type NotificationKind = 'low_stock' | 'order_due' | 'schedule_change'

export const NOTIFICATION_KINDS: { key: NotificationKind; label: string; text: string }[] = [
  { key: 'low_stock', label: 'Low stock', text: 'When an item drops to its reorder level or runs out' },
  { key: 'order_due', label: 'Order reminders', text: 'Each morning, for orders due in 2 days' },
  { key: 'schedule_change', label: 'Schedule changes', text: 'When the daily schedule’s times change' },
]

export interface PushMessage {
  title: string
  body: string
  /** Page opened when the notification is tapped. */
  url: string
  /** Same tag = replaces the earlier notification instead of stacking. */
  tag?: string
}

// ---------------------------------------------------------------------------
// Low stock
// ---------------------------------------------------------------------------

const SEVERITY: Record<InventoryStatusValue, number> = { ok: 0, low: 1, reorder: 2, out_of_stock: 3 }

/** Notify only when an item newly crosses into Reorder, or into Out of stock — never again for the same state. */
export function shouldAlertLowStock(before: InventoryStatusValue, after: InventoryStatusValue): boolean {
  return needsReorder(after) && SEVERITY[after] > SEVERITY[before]
}

export function lowStockMessage(item: {
  id: string
  name: string
  unit: string
  currentQuantity: number
  reorderLevel: number
  status: InventoryStatusValue
}): PushMessage {
  const out = item.status === 'out_of_stock'
  return {
    title: out ? `Out of stock: ${item.name}` : `Low stock: ${item.name}`,
    body: out
      ? `${item.name} has run out. Time to restock.`
      : `${item.currentQuantity} ${item.unit} left (reorder at ${item.reorderLevel} ${item.unit}).`,
    url: `/business/inventory/${item.id}`,
    tag: `stock-${item.id}`,
  }
}

// ---------------------------------------------------------------------------
// Orders due soon
// ---------------------------------------------------------------------------

export interface DueOrder {
  id: string
  customerName: string | null
  requiredDate: string
  requiredTime: string | null
  items: { name: string; quantity: number }[]
}

/** More than this many orders in one morning → one summary instead of one notification each. */
export const MAX_SEPARATE_ORDER_REMINDERS = 3

function whenLabel(daysAway: number): string {
  if (daysAway <= 0) return 'today'
  if (daysAway === 1) return 'tomorrow'
  return `in ${daysAway} days`
}

export function orderDueMessages(orders: DueOrder[], daysAwayOf: (order: DueOrder) => number): PushMessage[] {
  if (orders.length === 0) return []
  if (orders.length > MAX_SEPARATE_ORDER_REMINDERS) {
    const names = orders.map((o) => o.customerName ?? 'Walk-in')
    return [
      {
        title: `${orders.length} orders coming up`,
        body: `Due in the next 2 days: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` and ${names.length - 4} more` : ''}.`,
        url: '/orders',
        tag: 'order-due-summary',
      },
    ]
  }
  return orders.map((order) => {
    const items = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')
    const when = `${formatDateShort(order.requiredDate)}${order.requiredTime ? `, ${formatTime12(order.requiredTime)}` : ''}`
    return {
      title: `Order due ${whenLabel(daysAwayOf(order))}: ${order.customerName ?? 'Walk-in'}`,
      body: [items || 'No items listed', when].join(' · '),
      url: `/orders/${order.id}`,
      tag: `order-due-${order.id}`,
    }
  })
}

// ---------------------------------------------------------------------------
// Daily schedule changes
// ---------------------------------------------------------------------------

export interface ScheduleBlockSnapshot {
  title: string
  startTime: string // HH:MM or HH:MM:SS
  endTime: string
  isActive: boolean
}

const hhmm = (t: string) => t.slice(0, 5)
const span = (b: ScheduleBlockSnapshot) => `${formatTime12(hhmm(b.startTime))} – ${formatTime12(hhmm(b.endTime))}`

/**
 * The team only hears about changes to *when* things happen: a block added,
 * removed, turned on/off, or moved. Renames and task-list edits stay quiet.
 */
export function scheduleChangeMessage(
  before: ScheduleBlockSnapshot | null,
  after: ScheduleBlockSnapshot | null
): PushMessage | null {
  const base = { title: 'Schedule updated', url: '/today', tag: 'schedule-change' }

  if (!before && after) return after.isActive ? { ...base, body: `New: ${after.title}, ${span(after)}.` } : null
  if (before && !after) return before.isActive ? { ...base, body: `${before.title} (${span(before)}) was removed.` } : null
  if (!before || !after) return null

  if (before.isActive !== after.isActive) {
    return { ...base, body: after.isActive ? `${after.title} is back on: ${span(after)}.` : `${after.title} is off the schedule for now.` }
  }
  if (!after.isActive) return null

  const moved = hhmm(before.startTime) !== hhmm(after.startTime) || hhmm(before.endTime) !== hhmm(after.endTime)
  return moved ? { ...base, body: `${after.title} is now ${span(after)} (was ${span(before)}).` } : null
}
