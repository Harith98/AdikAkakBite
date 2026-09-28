import type { ScheduleBlockLike, TaskLike } from '@/lib/services/schedule'
import type { EngineInput, EngineOrder } from '@/lib/services/recommendation'

export const BLOCKS: ScheduleBlockLike[] = [
  { id: 'b-open', title: 'Opening & Planning', category: 'business', startTime: '11:00', endTime: '11:30', sortOrder: 0 },
  { id: 'b-prod', title: 'Production', category: 'production', startTime: '11:30', endTime: '13:00', sortOrder: 1 },
  { id: 'b-content', title: 'Content Creation', category: 'content', startTime: '13:00', endTime: '14:00', sortOrder: 2 },
  { id: 'b-break', title: 'Break', category: 'business', startTime: '14:00', endTime: '14:30', sortOrder: 3 },
]

export function task(overrides: Partial<TaskLike> & { id: string }): TaskLike {
  return {
    title: overrides.id,
    category: 'production',
    priority: 0,
    status: 'not_started',
    scheduledDate: '2026-09-28',
    scheduledTime: null,
    scheduleBlockId: null,
    sortOrder: 0,
    dailyPriorityRank: null,
    source: 'schedule',
    orderId: null,
    ...overrides,
  }
}

export function order(overrides: Partial<EngineOrder> & { id: string }): EngineOrder {
  return {
    customerName: 'Sarah',
    requiredDate: '2026-09-28',
    requiredTime: '16:00',
    status: 'confirmed',
    ...overrides,
  }
}

export function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    today: '2026-09-28',
    time: '11:42',
    blocks: BLOCKS,
    tasks: [],
    orders: [],
    inventoryAlerts: [],
    ...overrides,
  }
}
