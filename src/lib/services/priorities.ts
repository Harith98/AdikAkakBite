// Deterministic suggestions for "today's three priorities" (spec §10). No AI:
// straight rules over orders, overdue tasks and inventory.

import { formatTime12 } from '@/lib/time'
import {
  HIGH_PRIORITY,
  isActiveOrder,
  isOverdueTask,
  type EngineInventoryAlert,
  type EngineOrder,
} from './recommendation'
import type { TaskLike } from './schedule'

export interface PrioritySuggestion {
  title: string
  reason: string
}

export function getSuggestedPriorities(input: {
  today: string
  time: string
  orders: EngineOrder[]
  inventoryAlerts: EngineInventoryAlert[]
  tasks: TaskLike[]
  existingTitles: string[]
  max?: number
}): PrioritySuggestion[] {
  const suggestions: PrioritySuggestion[] = []

  const dueOrders = input.orders
    .filter((o) => isActiveOrder(o.status) && o.requiredDate !== null && o.requiredDate <= input.today)
    .sort((a, b) => (a.requiredDate ?? '').localeCompare(b.requiredDate ?? '') || (a.requiredTime ?? '').localeCompare(b.requiredTime ?? ''))
  for (const order of dueOrders.slice(0, 2)) {
    const name = order.customerName ?? 'a customer'
    const when = order.requiredTime ? ` (${formatTime12(order.requiredTime)})` : ''
    suggestions.push({
      title: `Fulfil ${name}'s order${when}`,
      reason: order.requiredDate === input.today ? 'Order due today' : 'Order is overdue',
    })
  }

  for (const task of input.tasks.filter((t) => t.priority >= HIGH_PRIORITY && isOverdueTask(t, input.today, input.time))) {
    suggestions.push({ title: task.title, reason: 'High-priority task that is overdue' })
  }

  if (input.inventoryAlerts.length > 0) {
    const names = input.inventoryAlerts.slice(0, 2).map((i) => i.name).join(' & ')
    suggestions.push({ title: `Reorder ${names}`, reason: 'At or below reorder level' })
  }

  const existing = new Set(input.existingTitles.map((t) => t.trim().toLowerCase()))
  const seen = new Set<string>()
  return suggestions
    .filter((s) => {
      const key = s.title.trim().toLowerCase()
      if (existing.has(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, input.max ?? 3)
}
